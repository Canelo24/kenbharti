-- v9 additions — safe to run any number of times, touches no existing data.
alter table tokens  add column if not exists phone text;
alter table entries add column if not exists photo_screen_url text;
