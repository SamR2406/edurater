-- Allow guest staff requests by making user_id optional.

alter table public.staff_requests
  alter column user_id drop not null;

drop policy if exists "Staff requests are insertable by owners" on public.staff_requests;
create policy "Staff requests are insertable by owners"
  on public.staff_requests
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Staff requests are insertable by guests" on public.staff_requests;
create policy "Staff requests are insertable by guests"
  on public.staff_requests
  for insert
  with check (auth.uid() is null and user_id is null);
