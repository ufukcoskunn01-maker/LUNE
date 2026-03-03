-- Base AI thread/message schema (idempotent)
create extension if not exists pgcrypto;

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
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists ai_threads_select_own on public.ai_threads;
create policy ai_threads_select_own
on public.ai_threads
for select
using (user_id = auth.uid());

drop policy if exists ai_threads_insert_own on public.ai_threads;
create policy ai_threads_insert_own
on public.ai_threads
for insert
with check (user_id = auth.uid());

drop policy if exists ai_threads_update_own on public.ai_threads;
create policy ai_threads_update_own
on public.ai_threads
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists ai_threads_delete_own on public.ai_threads;
create policy ai_threads_delete_own
on public.ai_threads
for delete
using (user_id = auth.uid());

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own
on public.ai_messages
for select
using (user_id = auth.uid());

drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own
on public.ai_messages
for insert
with check (user_id = auth.uid());

drop policy if exists ai_messages_update_own on public.ai_messages;
create policy ai_messages_update_own
on public.ai_messages
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists ai_messages_delete_own on public.ai_messages;
create policy ai_messages_delete_own
on public.ai_messages
for delete
using (user_id = auth.uid());
