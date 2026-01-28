-- Add staff request details and allow admin_users to manage requests.

alter table public.staff_requests
  add column if not exists full_name text,
  add column if not exists position text,
  add column if not exists school_email text;

drop policy if exists "Staff requests are viewable by admins" on public.staff_requests;
create policy "Staff requests are viewable by admins"
  on public.staff_requests
  for select
  using (
    exists (
      select 1
      from public.admin_users as au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Staff requests are updatable by admins" on public.staff_requests;
create policy "Staff requests are updatable by admins"
  on public.staff_requests
  for update
  using (
    exists (
      select 1
      from public.admin_users as au
      where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as au
      where au.user_id = auth.uid()
    )
  );
