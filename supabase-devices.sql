-- QR login + device management (Supabase SQL Editor → New query → Run)
-- LoginTicket: RLS deny-all (koi policy nahi) — access sirf Vercel API (service_role) se.
-- UserDevice: RLS own-data (dashboard seedha padhta hai).

-- 1. QR login ke one-time ticket (2-min expiry, single-use)
create table if not exists "LoginTicket" (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  device_label text default '',
  ip text default '',
  approved_by uuid references auth.users(id) on delete cascade,
  action_link text,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '2 minutes'
);
create index if not exists "LoginTicket_status_expires_idx" on "LoginTicket" (status, expires_at);
alter table "LoginTicket" enable row level security;
-- jaan-boojh ke koi policy nahi: anon/authenticated direct access blocked, sirf service_role.

-- 2. Logged-in browsers (remote logout + device list)
create table if not exists "UserDevice" (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  ip text default '',
  revoked boolean default false,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists "UserDevice_user_seen_idx" on "UserDevice" (user_id, last_seen desc);
alter table "UserDevice" enable row level security;

drop policy if exists "own data" on "UserDevice";
create policy "own data" on "UserDevice" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
