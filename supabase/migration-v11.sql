-- v11: adds the optional PRACTICE round (audience warm-up quiz).
-- Safe to run any number of times. Adds nothing to existing data —
-- it only widens which round names are allowed.

alter table votes   drop constraint if exists votes_round_check;
alter table votes   add  constraint votes_round_check
  check (round in ('rangoli','dance','practice'));

alter table entries drop constraint if exists entries_round_check;
alter table entries add  constraint entries_round_check
  check (round in ('rangoli','dance','practice'));

insert into settings (key, value) values ('practice_status', 'locked')
on conflict (key) do nothing;
