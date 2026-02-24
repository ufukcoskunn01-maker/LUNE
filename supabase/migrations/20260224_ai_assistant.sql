-- LUNE AI Assistant module
-- Creates RAG knowledge storage, threads/messages, usage tracking, and access policies.

create extension if not exists vector;
create extension if not exists pgcrypto;

create or replace function public.is_ai_admin(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  result boolean;
begin
  if user_uuid is null then
    return false;
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'select coalesce((select is_admin from public.profiles where id = $1 limit 1), false)'
      into result
      using user_uuid;
    return coalesce(result, false);
  end if;

  if to_regclass('public.ai_admins') is null then
    return false;
  end if;

  execute 'select exists(select 1 from public.ai_admins where user_id = $1)'
    into result
    using user_uuid;

  return coalesce(result, false);
end;
$$;

create table if not exists public.ai_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_code text not null,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now(),
  tokens int,
  meta jsonb
);

create table if not exists public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  title text not null,
  content text not null,
  tags text[],
  embedding vector(1536) not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  messages_count int not null default 0,
  tokens_count int not null default 0,
  primary key (user_id, day)
);

create index if not exists ai_threads_user_project_created_idx
  on public.ai_threads(user_id, project_code, created_at desc);

create index if not exists ai_messages_thread_created_idx
  on public.ai_messages(thread_id, created_at asc);

create index if not exists ai_knowledge_project_updated_idx
  on public.ai_knowledge(project_code, updated_at desc);

create index if not exists ai_knowledge_embedding_ivfflat_idx
  on public.ai_knowledge
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.set_ai_knowledge_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_knowledge_updated_at on public.ai_knowledge;

create trigger trg_ai_knowledge_updated_at
before update on public.ai_knowledge
for each row
execute function public.set_ai_knowledge_updated_at();

create or replace function public.match_ai_knowledge(
  query_embedding vector(1536),
  project_code text,
  match_count int default 6
)
returns table (
  id uuid,
  title text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    k.id,
    k.title,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.ai_knowledge k
  where k.project_code = match_ai_knowledge.project_code
  order by k.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.increment_ai_usage(
  p_user_id uuid,
  p_day date,
  p_message_inc int default 1,
  p_token_inc int default 0,
  p_message_limit int default 200
)
returns table (
  allowed boolean,
  messages_count int,
  tokens_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_messages int;
  next_messages int;
begin
  if p_user_id is null then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.ai_usage_daily(user_id, day, messages_count, tokens_count)
  values (p_user_id, p_day, 0, 0)
  on conflict (user_id, day) do nothing;

  select u.messages_count
  into current_messages
  from public.ai_usage_daily u
  where u.user_id = p_user_id and u.day = p_day
  for update;

  next_messages := coalesce(current_messages, 0) + greatest(p_message_inc, 0);

  if next_messages > p_message_limit then
    return query
    select false, coalesce(current_messages, 0), coalesce(u.tokens_count, 0)
    from public.ai_usage_daily u
    where u.user_id = p_user_id and u.day = p_day;
    return;
  end if;

  update public.ai_usage_daily
  set
    messages_count = next_messages,
    tokens_count = coalesce(tokens_count, 0) + greatest(p_token_inc, 0)
  where user_id = p_user_id and day = p_day;

  return query
  select true, u.messages_count, u.tokens_count
  from public.ai_usage_daily u
  where u.user_id = p_user_id and u.day = p_day;
end;
$$;

grant execute on function public.match_ai_knowledge(vector, text, int) to authenticated;
grant execute on function public.increment_ai_usage(uuid, date, int, int, int) to authenticated;
grant execute on function public.is_ai_admin(uuid) to authenticated;

alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_knowledge enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.ai_admins enable row level security;

drop policy if exists ai_threads_own_select on public.ai_threads;
create policy ai_threads_own_select
on public.ai_threads
for select
using (auth.uid() = user_id);

drop policy if exists ai_threads_own_insert on public.ai_threads;
create policy ai_threads_own_insert
on public.ai_threads
for insert
with check (auth.uid() = user_id);

drop policy if exists ai_threads_own_update on public.ai_threads;
create policy ai_threads_own_update
on public.ai_threads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ai_threads_own_delete on public.ai_threads;
create policy ai_threads_own_delete
on public.ai_threads
for delete
using (auth.uid() = user_id);

drop policy if exists ai_messages_own_select on public.ai_messages;
create policy ai_messages_own_select
on public.ai_messages
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.ai_threads t
    where t.id = ai_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists ai_messages_own_insert on public.ai_messages;
create policy ai_messages_own_insert
on public.ai_messages
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.ai_threads t
    where t.id = ai_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists ai_messages_own_update on public.ai_messages;
create policy ai_messages_own_update
on public.ai_messages
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.ai_threads t
    where t.id = ai_messages.thread_id
      and t.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.ai_threads t
    where t.id = ai_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists ai_messages_own_delete on public.ai_messages;
create policy ai_messages_own_delete
on public.ai_messages
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.ai_threads t
    where t.id = ai_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists ai_knowledge_authenticated_read on public.ai_knowledge;
create policy ai_knowledge_authenticated_read
on public.ai_knowledge
for select
to authenticated
using (true);

drop policy if exists ai_knowledge_admin_insert on public.ai_knowledge;
create policy ai_knowledge_admin_insert
on public.ai_knowledge
for insert
to authenticated
with check (public.is_ai_admin(auth.uid()));

drop policy if exists ai_knowledge_admin_update on public.ai_knowledge;
create policy ai_knowledge_admin_update
on public.ai_knowledge
for update
to authenticated
using (public.is_ai_admin(auth.uid()))
with check (public.is_ai_admin(auth.uid()));

drop policy if exists ai_knowledge_admin_delete on public.ai_knowledge;
create policy ai_knowledge_admin_delete
on public.ai_knowledge
for delete
to authenticated
using (public.is_ai_admin(auth.uid()));

drop policy if exists ai_usage_daily_own_select on public.ai_usage_daily;
create policy ai_usage_daily_own_select
on public.ai_usage_daily
for select
using (auth.uid() = user_id);

drop policy if exists ai_usage_daily_own_insert on public.ai_usage_daily;
create policy ai_usage_daily_own_insert
on public.ai_usage_daily
for insert
with check (auth.uid() = user_id);

drop policy if exists ai_usage_daily_own_update on public.ai_usage_daily;
create policy ai_usage_daily_own_update
on public.ai_usage_daily
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ai_admins_admin_manage on public.ai_admins;
create policy ai_admins_admin_manage
on public.ai_admins
for all
to authenticated
using (public.is_ai_admin(auth.uid()))
with check (public.is_ai_admin(auth.uid()));
