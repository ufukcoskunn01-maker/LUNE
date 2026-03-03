alter table if exists public.ai_messages
  add column if not exists tokens int;

alter table if exists public.ai_messages
  add column if not exists meta jsonb;
