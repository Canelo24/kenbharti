-- ============================================================
-- REPAIR SCRIPT — safe to run ANY number of times.
-- Creates anything missing, never duplicates, never deletes data.
-- Paste the WHOLE file into Supabase: SQL Editor -> New query -> Run.
-- ============================================================

create table if not exists tokens (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  display_code  text unique not null,
  holder_name   text,
  is_reserve    boolean default false,
  active        boolean default true,
  created_at    timestamptz default now()
);

create table if not exists entries (
  id        serial primary key,
  round     text not null check (round in ('rangoli','dance')),
  name      text not null,
  photo_url text,
  sort      int default 0,
  active    boolean default true
);

create table if not exists votes (
  id         bigserial primary key,
  token_id   uuid not null references tokens(id),
  round      text not null check (round in ('rangoli','dance')),
  entry_id   int  not null references entries(id),
  created_at timestamptz default now(),
  unique (token_id, round)
);

-- Belt and braces: make sure the one-vote-per-round constraint exists
-- even if the votes table was somehow created without it.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.votes'::regclass
      and contype = 'u'
  ) then
    alter table votes add constraint votes_token_id_round_key
      unique (token_id, round);
  end if;
end $$;

create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

create table if not exists prizes (
  id     serial primary key,
  name   text not null,
  sort   int default 0,
  status text default 'pending' check (status in ('pending','drawn','claimed'))
);

create table if not exists draws (
  id        bigserial primary key,
  prize_id  int  not null references prizes(id),
  token_id  uuid not null references tokens(id),
  drawn_at  timestamptz default now(),
  status    text default 'pending_claim'
            check (status in ('pending_claim','claimed','redrawn'))
);

create index if not exists votes_round_idx on votes (round);
create index if not exists votes_entry_idx on votes (round, entry_id);
create index if not exists tokens_display_idx on tokens (display_code);

-- Deny-all Row Level Security (idempotent)
alter table tokens   enable row level security;
alter table entries  enable row level security;
alter table votes    enable row level security;
alter table settings enable row level security;
alter table prizes   enable row level security;
alter table draws    enable row level security;

-- Public photo bucket
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Default settings (only fills in missing keys)
insert into settings (key, value) values
  ('rangoli_status', 'locked'),
  ('dance_status',   'locked'),
  ('screen_mode',    'idle'),
  ('raffle_pool',    'range'),
  ('active_ranges',  'KB-0001-KB-0800'),
  ('raffle_current', '')
on conflict (key) do nothing;

-- Sample entries — added ONLY if the entries table is completely empty
insert into entries (round, name, sort)
select v.round, v.name, v.sort from (values
  ('rangoli', 'Rangoli 1', 1),
  ('rangoli', 'Rangoli 2', 2),
  ('rangoli', 'Rangoli 3', 3),
  ('rangoli', 'Rangoli 4', 4),
  ('rangoli', 'Rangoli 5', 5),
  ('rangoli', 'Rangoli 6', 6),
  ('dance',   'Dance Group 1', 1),
  ('dance',   'Dance Group 2', 2),
  ('dance',   'Dance Group 3', 3),
  ('dance',   'Dance Group 4', 4)
) as v(round, name, sort)
where not exists (select 1 from entries);

-- Prizes — added ONLY if the prizes table is completely empty
insert into prizes (name, sort)
select v.name, v.sort from (values
  ('Gift Hamper 1', 1),
  ('Gift Hamper 2', 2),
  ('Gift Hamper 3', 3),
  ('Gift Hamper 4', 4),
  ('Gift Hamper 5', 5),
  ('Gift Hamper 6', 6),
  ('Flight Ticket 1', 101),
  ('Flight Ticket 2', 102),
  ('Flight Ticket 3', 103),
  ('Flight Ticket 4', 104)
) as v(name, sort)
where not exists (select 1 from prizes);

-- Final report: you should see all six tables listed with row counts
select 'tokens' as table_name, count(*) as rows from tokens
union all select 'entries',  count(*) from entries
union all select 'votes',    count(*) from votes
union all select 'settings', count(*) from settings
union all select 'prizes',   count(*) from prizes
union all select 'draws',    count(*) from draws
order by table_name;
