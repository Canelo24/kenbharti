-- ============================================================
-- Kenbharti "Maa Tujhe Salaam" — database schema
-- Paste this WHOLE file into Supabase: SQL Editor -> New query -> Run
-- Safe to run once on a fresh project.
-- ============================================================

create table tokens (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,     -- unguessable, used in QR URL
  display_code  text unique not null,     -- 'KB-0347' printed on card
  holder_name   text,                     -- captured at first vote (for raffle display)
  is_reserve    boolean default false,
  active        boolean default true,     -- admin can void a lost card
  created_at    timestamptz default now()
);

create table entries (
  id        serial primary key,
  round     text not null check (round in ('rangoli','dance')),
  name      text not null,
  photo_url text,
  sort      int default 0,
  active    boolean default true
);

create table votes (
  id         bigserial primary key,
  token_id   uuid not null references tokens(id),
  round      text not null check (round in ('rangoli','dance')),
  entry_id   int  not null references entries(id),
  created_at timestamptz default now(),
  unique (token_id, round)   -- THE one-vote-per-round guarantee
);

create table settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

create table prizes (
  id     serial primary key,
  name   text not null,
  sort   int default 0,
  status text default 'pending' check (status in ('pending','drawn','claimed'))
);

create table draws (
  id        bigserial primary key,
  prize_id  int  not null references prizes(id),
  token_id  uuid not null references tokens(id),
  drawn_at  timestamptz default now(),
  status    text default 'pending_claim'
            check (status in ('pending_claim','claimed','redrawn'))
);

-- Helpful indexes for the night
create index votes_round_idx on votes (round);
create index votes_entry_idx on votes (round, entry_id);
create index tokens_display_idx on tokens (display_code);

-- ------------------------------------------------------------
-- Row Level Security: deny-all. The public internet can read
-- and write NOTHING directly. Every read/write goes through the
-- Next.js server using the service-role key (which bypasses RLS).
-- ------------------------------------------------------------
alter table tokens   enable row level security;
alter table entries  enable row level security;
alter table votes    enable row level security;
alter table settings enable row level security;
alter table prizes   enable row level security;
alter table draws    enable row level security;
-- (no policies created on purpose = nobody gets in)

-- ------------------------------------------------------------
-- Storage bucket for entry photos (publicly viewable images)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Seed: default settings
-- ------------------------------------------------------------
insert into settings (key, value) values
  ('rangoli_status', 'locked'),
  ('dance_status',   'locked'),
  ('screen_mode',    'idle'),
  ('raffle_pool',    'range'),        -- 'range' = distributed range | 'voted' = voted only
  ('active_ranges',  'KB-0001-KB-0800'),
  ('raffle_current', '')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Seed: sample entries (replace names/photos in the admin panel)
-- ------------------------------------------------------------
insert into entries (round, name, sort) values
  ('rangoli', 'Rangoli 1', 1),
  ('rangoli', 'Rangoli 2', 2),
  ('rangoli', 'Rangoli 3', 3),
  ('rangoli', 'Rangoli 4', 4),
  ('rangoli', 'Rangoli 5', 5),
  ('rangoli', 'Rangoli 6', 6),
  ('dance',   'Dance Group 1', 1),
  ('dance',   'Dance Group 2', 2),
  ('dance',   'Dance Group 3', 3),
  ('dance',   'Dance Group 4', 4);

-- ------------------------------------------------------------
-- Seed: prizes (hampers first, flight tickets last — the finale)
-- ------------------------------------------------------------
insert into prizes (name, sort) values
  ('Gift Hamper 1', 1),
  ('Gift Hamper 2', 2),
  ('Gift Hamper 3', 3),
  ('Gift Hamper 4', 4),
  ('Gift Hamper 5', 5),
  ('Gift Hamper 6', 6),
  ('Flight Ticket 1', 101),
  ('Flight Ticket 2', 102),
  ('Flight Ticket 3', 103),
  ('Flight Ticket 4', 104);
