-- Allow admins and owners to delete reviews.

drop policy if exists "Reviews are deletable by owner" on public.reviews;
create policy "Reviews are deletable by owner"
  on public.reviews
  for delete
  using (user_id = auth.uid());

drop policy if exists "Reviews are deletable by admins" on public.reviews;
create policy "Reviews are deletable by admins"
  on public.reviews
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    )
    or exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );
