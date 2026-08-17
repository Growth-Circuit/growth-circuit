-- Verified users must be able to finish account setup before community posting is enabled.
drop policy if exists community_profiles_insert_self on public.community_profiles;

create policy community_profiles_insert_self on public.community_profiles
for insert
with check (
  id = auth.uid()
  and public.community_has_verified_email()
);
