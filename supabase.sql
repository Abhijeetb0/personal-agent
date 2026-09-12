-- Supabase Dashboard → SQL Editor → New query → paste + Run.
-- (Prisma migrate ki zarurat nahi, yehi tables kaafi hain.)

create table if not exists "WhatsappSession" (
  id text primary key default 'default',
  "userId" text default 'owner',
  "authBlob" jsonb,
  status text default 'disconnected',
  qr text,
  "updatedAt" timestamptz default now()
);

create table if not exists "Setting" (
  "userId" text primary key default 'owner',
  "ownerNumber" text default '917761815151',
  "updatedAt" timestamptz default now()
);

create table if not exists "Message" (
  id text primary key default gen_random_uuid()::text,
  "fromNumber" text not null,
  body text not null,
  reply text,
  "isOwner" boolean default false,
  "createdAt" timestamptz default now()
);
create index if not exists "Message_from_created_idx" on "Message" ("fromNumber", "createdAt");

create table if not exists "Reminder" (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  "remindAt" timestamptz not null,
  sent boolean default false,
  source text default 'custom',
  "createdAt" timestamptz default now()
);
create index if not exists "Reminder_sent_remind_idx" on "Reminder" (sent, "remindAt");

insert into "Setting" ("userId", "ownerNumber")
values ('owner', '917761815151')
on conflict ("userId") do nothing;

-- Long-term memory (v2): user ki pakki baatein
create table if not exists "Memory" (
  id text primary key default gen_random_uuid()::text,
  fact text not null,
  "createdAt" timestamptz default now()
);
create index if not exists "Memory_created_idx" on "Memory" ("createdAt");
