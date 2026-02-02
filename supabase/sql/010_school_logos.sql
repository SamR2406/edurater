alter table "School data"
  add column if not exists logo_url text;

alter table "School data"
  add column if not exists logo_source text;

alter table "School data"
  add column if not exists logo_last_checked timestamptz;
