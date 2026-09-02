-- Tradeline cloud save — run this once in Supabase: SQL Editor → New query → paste → Run.
-- One row per workspace per user. The whole app state lives in `data` (jsonb).

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name text not null default '',
  trade text default '',
  seed text default 'blank',
  data jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.workspaces enable row level security;

-- Users can only ever touch their own rows.
create policy "workspaces select own" on public.workspaces for select using (auth.uid() = user_id);
create policy "workspaces insert own" on public.workspaces for insert with check (auth.uid() = user_id);
create policy "workspaces update own" on public.workspaces for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspaces delete own" on public.workspaces for delete using (auth.uid() = user_id);
