-- One-shot production bootstrap for the only two Growth Circuit administrators.
-- Replace all four values in the final select with the exact verified Auth records
-- reviewed in the Supabase dashboard. Run the whole file as the database owner.
-- The transaction aborts unless the two UUID and email pairs match confirmed users.

begin;

lock table public.community_admins in access exclusive mode;

create or replace function public.community_bootstrap_exact_admins(
  nick_id uuid,
  nick_email text,
  lucy_id uuid,
  lucy_email text
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  verified_matches integer;
  final_admins integer;
begin
  if nick_id = lucy_id or lower(btrim(nick_email)) = lower(btrim(lucy_email)) then
    raise exception 'admin bootstrap requires two distinct verified identities';
  end if;

  select count(*)::integer into verified_matches
  from auth.users
  where email_confirmed_at is not null
    and (
      (id = nick_id and lower(email) = lower(btrim(nick_email)))
      or (id = lucy_id and lower(email) = lower(btrim(lucy_email)))
    );

  if verified_matches <> 2 then
    raise exception 'admin bootstrap UUID and verified email review did not match exactly two Auth users';
  end if;

  insert into public.community_admins (user_id)
  values (nick_id), (lucy_id)
  on conflict (user_id) do nothing;

  delete from public.community_admins
  where user_id not in (nick_id, lucy_id);

  select count(*)::integer into final_admins from public.community_admins;
  if final_admins <> 2
     or not exists (select 1 from public.community_admins where user_id = nick_id)
     or not exists (select 1 from public.community_admins where user_id = lucy_id) then
    raise exception 'admin bootstrap did not finish with exactly the reviewed two administrators';
  end if;
end;
$$;

revoke all on function public.community_bootstrap_exact_admins(uuid, text, uuid, text) from public, anon, authenticated;

select public.community_bootstrap_exact_admins(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'replace-with-nick-verified-email@example.invalid',
  '00000000-0000-0000-0000-000000000002'::uuid,
  'replace-with-lucy-verified-email@example.invalid'
);

do $$
begin
  if (select count(*) from public.community_admins) <> 2 then
    raise exception 'final independent assertion expected exactly two administrators';
  end if;
end;
$$;

drop function public.community_bootstrap_exact_admins(uuid, text, uuid, text);

commit;
