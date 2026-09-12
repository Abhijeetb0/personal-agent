-- MULTI-USER migration (Supabase SQL Editor → New query → Run)
-- Purani single-user tables rehne do (baad me dashboard se delete kar dena).
-- Pehle: Authentication → Sign In/Up → "Confirm email" OFF karo (warna login atakega).

-- 1. Per-user settings (owner = wo number jis se user agent se baat karega)
create table if not exists "UserSetting" (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_number text not null default '',
  updated_at timestamptz default now()
);

-- 2. Per-user WhatsApp session (QR/auth blob)
create table if not exists "WaSession" (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auth_blob jsonb,
  status text default 'disconnected',
  qr text,
  updated_at timestamptz default now()
);

-- 3. Chat history (per user)
create table if not exists "Message" (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_number text not null,
  body text not null,
  reply text,
  is_owner boolean default false,
  created_at timestamptz default now()
);
create index if not exists "Message_user_created_idx" on "Message" (user_id, created_at desc);

-- 4. Reminders (per user)
create table if not exists "Reminder" (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  remind_at timestamptz not null,
  sent boolean default false,
  source text default 'custom',
  created_at timestamptz default now()
);
create index if not exists "Reminder_user_sent_idx" on "Reminder" (user_id, sent, remind_at);

-- 5. Long-term memory (per user)
create table if not exists "Memory" (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  fact text not null,
  created_at timestamptz default now()
);
create index if not exists "Memory_user_created_idx" on "Memory" (user_id, created_at desc);

-- 6. RLS: user sirf apna data dekhe (agent service_role key se bypass karta hai)
alter table "UserSetting" enable row level security;
alter table "WaSession" enable row level security;
alter table "Message" enable row level security;
alter table "Reminder" enable row level security;
alter table "Memory" enable row level security;

drop policy if exists "own data" on "UserSetting";
drop policy if exists "own data" on "WaSession";
drop policy if exists "own data" on "Message";
drop policy if exists "own data" on "Reminder";
drop policy if exists "own data" on "Memory";

create policy "own data" on "UserSetting" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on "WaSession" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on "Message" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on "Reminder" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on "Memory" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
