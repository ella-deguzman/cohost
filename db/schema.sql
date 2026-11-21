-- AI Co-Host, MVP step 1: sign-in and saved event drafts.
-- Safe to run more than once.

create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text,
  created_at   timestamptz not null default now()
);

-- One-time email sign-in links. Only a hash of the token is stored.
create table if not exists login_tokens (
  token_hash text primary key,
  email      text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists login_tokens_email_idx on login_tokens (email, created_at);

create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id                 uuid primary key default gen_random_uuid(),
  host_id            uuid not null references users(id),
  title              text not null check (length(title) between 1 and 120),
  description        text not null default '',
  event_date         date,
  event_time         time,
  time_zone          text,
  location           text not null default '',
  planning_headcount integer check (planning_headcount > 0),
  budget_amount      numeric(12,2) check (budget_amount >= 0),
  currency           text not null default 'USD',
  notes              text not null default '',
  status             text not null default 'draft'
                       check (status in ('draft', 'published', 'cancelled')),
  plan_version       integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- The idea board on the left page: occasion, vibes and where each piece was dragged.
alter table events add column if not exists collage jsonb not null default '{}'::jsonb;

create index if not exists events_host_idx on events (host_id, updated_at desc);

-- One row per person per event. The host gets one when the event is created.
create table if not exists event_members (
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null check (role in ('host', 'cohost', 'guest')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create unique index if not exists one_host_per_event
  on event_members (event_id) where role = 'host';

-- Inspiration photos for the idea board. Stored in the database as small JPEGs
-- (the browser shrinks them first), so there is nothing else to set up.
create table if not exists event_photos (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  data       bytea not null,
  width      integer not null check (width between 1 and 4000),
  height     integer not null check (height between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists event_photos_event_idx on event_photos (event_id, created_at);
