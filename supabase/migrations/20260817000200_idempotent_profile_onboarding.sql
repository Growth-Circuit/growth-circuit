-- Profile setup can be retried before launch without enabling community content writes.
drop policy if exists community_profiles_update_self on public.community_profiles;

create policy community_profiles_update_self on public.community_profiles
for update
using (
  id = auth.uid()
  and public.community_has_verified_email()
)
with check (
  id = auth.uid()
  and public.community_has_verified_email()
);
