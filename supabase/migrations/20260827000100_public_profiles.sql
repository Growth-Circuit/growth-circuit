-- Public profiles are independent of the parked community forum feature gate.
alter table public.community_profiles
  add column if not exists handle text,
  add column if not exists headline text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists location text not null default '',
  add column if not exists website_url text,
  add column if not exists profile_state text not null default 'draft',
  add column if not exists profile_moderation_state text not null default 'visible',
  add column if not exists published_at timestamptz;

alter table public.community_profiles
  drop constraint if exists community_profiles_handle_check,
  add constraint community_profiles_handle_check check (handle is null or handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(handle) between 3 and 40 and handle not in ('admin', 'api', 'auth', 'claim', 'edit', 'events')),
  drop constraint if exists community_profiles_headline_check,
  add constraint community_profiles_headline_check check (char_length(headline) <= 140),
  drop constraint if exists community_profiles_bio_check,
  add constraint community_profiles_bio_check check (char_length(bio) <= 1000),
  drop constraint if exists community_profiles_location_check,
  add constraint community_profiles_location_check check (char_length(location) <= 100),
  drop constraint if exists community_profiles_website_url_check,
  add constraint community_profiles_website_url_check check (website_url is null or website_url ~ '^https?://'),
  drop constraint if exists community_profiles_state_check,
  add constraint community_profiles_state_check check (profile_state in ('draft', 'published')),
  drop constraint if exists community_profiles_moderation_check,
  add constraint community_profiles_moderation_check check (profile_moderation_state in ('visible', 'hidden')),
  drop constraint if exists community_profiles_publish_check,
  add constraint community_profiles_publish_check check (
    (profile_state = 'published' and handle is not null and headline <> '' and bio <> '' and published_at is not null)
    or (profile_state = 'draft' and published_at is null)
  );

create unique index if not exists community_profiles_handle_idx on public.community_profiles (handle) where handle is not null;
create index if not exists community_profiles_directory_idx on public.community_profiles (profile_state, profile_moderation_state, published_at desc);

create table if not exists public.community_projects (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.community_profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  url text not null check (char_length(url) <= 500 and url ~ '^https?://'),
  kind text not null check (kind in ('website', 'github', 'doorway', 'demo')),
  position smallint not null check (position between 0 and 11),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, position)
);

create table if not exists public.community_profile_moderation_audits (
  id bigint generated always as identity primary key,
  request_id uuid not null default extensions.gen_random_uuid() unique,
  actor_id uuid not null references public.community_admins(user_id) on delete restrict,
  profile_id uuid not null references public.community_profiles(id) on delete restrict,
  previous_state text not null check (previous_state in ('visible', 'hidden')),
  new_state text not null check (new_state in ('visible', 'hidden')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

create or replace function public.community_complete_profile(first_name_input text, last_name_input text)
returns public.community_profiles language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); saved public.community_profiles;
begin
  if actor is null or not public.community_has_verified_email() then raise exception 'verified profile required' using errcode = '42501'; end if;
  if btrim(coalesce(first_name_input, '')) = '' or char_length(btrim(first_name_input)) > 80
    or btrim(coalesce(last_name_input, '')) = '' or char_length(btrim(last_name_input)) > 80 then
    raise exception 'invalid profile name' using errcode = '22023';
  end if;
  insert into public.community_profiles (id, first_name, last_name)
  values (actor, btrim(first_name_input), btrim(last_name_input))
  on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, updated_at = clock_timestamp()
  returning * into saved;
  return saved;
end;
$$;

drop trigger if exists community_profile_moderation_audits_immutable on public.community_profile_moderation_audits;
create trigger community_profile_moderation_audits_immutable before update or delete on public.community_profile_moderation_audits
  for each row execute function public.community_reject_audit_mutation();

create or replace function public.community_save_public_profile(
  first_name_input text, last_name_input text, handle_input text, headline_input text,
  bio_input text, location_input text, website_url_input text, state_input text, projects_input jsonb
) returns public.community_profiles language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); saved public.community_profiles; item jsonb; item_count integer; item_position integer := 0;
begin
  if actor is null or not public.community_has_verified_email() then raise exception 'verified profile required' using errcode = '42501'; end if;
  if btrim(coalesce(first_name_input, '')) = '' or char_length(btrim(first_name_input)) > 80
    or btrim(coalesce(last_name_input, '')) = '' or char_length(btrim(last_name_input)) > 80
    or handle_input !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(handle_input) not between 3 and 40
    or handle_input in ('admin', 'api', 'auth', 'claim', 'edit', 'events')
    or state_input not in ('draft', 'published')
    or char_length(coalesce(headline_input, '')) > 140 or char_length(coalesce(bio_input, '')) > 1000
    or char_length(coalesce(location_input, '')) > 100
    or (nullif(website_url_input, '') is not null and website_url_input !~ '^https?://')
    or (state_input = 'published' and (btrim(coalesce(headline_input, '')) = '' or btrim(coalesce(bio_input, '')) = ''))
    or jsonb_typeof(projects_input) <> 'array' then
    raise exception 'invalid public profile' using errcode = '22023';
  end if;
  item_count := jsonb_array_length(projects_input);
  if item_count > 12 then raise exception 'project limit exceeded' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(projects_input) loop
    if btrim(coalesce(item->>'title', '')) = '' or char_length(item->>'title') > 120
      or btrim(coalesce(item->>'description', '')) = '' or char_length(item->>'description') > 500
      or coalesce(item->>'url', '') !~ '^https?://' or char_length(item->>'url') > 500
      or coalesce(item->>'kind', '') not in ('website', 'github', 'doorway', 'demo') then
      raise exception 'invalid project' using errcode = '22023';
    end if;
  end loop;
  insert into public.community_profiles (id, first_name, last_name, handle, headline, bio, location, website_url, profile_state, published_at)
  values (actor, btrim(first_name_input), btrim(last_name_input), handle_input, btrim(headline_input), btrim(bio_input), btrim(location_input), nullif(website_url_input, ''), state_input, case when state_input = 'published' then clock_timestamp() end)
  on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, handle = excluded.handle,
    headline = excluded.headline, bio = excluded.bio, location = excluded.location, website_url = excluded.website_url,
    profile_state = excluded.profile_state, published_at = excluded.published_at, updated_at = clock_timestamp()
  returning * into saved;
  delete from public.community_projects where owner_id = actor;
  for item in select value from jsonb_array_elements(projects_input) loop
    insert into public.community_projects (owner_id, title, description, url, kind, position)
    values (actor, btrim(item->>'title'), btrim(item->>'description'), item->>'url', item->>'kind', item_position);
    item_position := item_position + 1;
  end loop;
  return saved;
exception when unique_violation then
  raise exception 'handle unavailable' using errcode = '23505';
end;
$$;

create or replace function public.community_moderate_profile(profile_input uuid, state_input text, reason_input text, request_id_input uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); old_state text; prior public.community_profile_moderation_audits;
begin
  if not public.community_is_admin(actor) then raise exception 'admin required' using errcode = '42501'; end if;
  if state_input not in ('visible', 'hidden') or btrim(coalesce(reason_input, '')) = '' or request_id_input is null then
    raise exception 'invalid moderation change' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id_input::text, 0));
  select * into prior from public.community_profile_moderation_audits where request_id = request_id_input;
  if prior.id is not null then
    if prior.actor_id <> actor or prior.profile_id <> profile_input or prior.new_state <> state_input or prior.reason <> btrim(reason_input) then
      raise exception 'request id reuse mismatch' using errcode = '22023';
    end if;
    return;
  end if;
  select profile_moderation_state into old_state from public.community_profiles where id = profile_input for update;
  if old_state is null then raise exception 'profile unavailable' using errcode = '42501'; end if;
  update public.community_profiles set profile_moderation_state = state_input, updated_at = clock_timestamp() where id = profile_input;
  insert into public.community_profile_moderation_audits (request_id, actor_id, profile_id, previous_state, new_state, reason)
  values (request_id_input, actor, profile_input, old_state, state_input, btrim(reason_input));
end;
$$;

alter table public.community_projects enable row level security;
alter table public.community_projects force row level security;
alter table public.community_profile_moderation_audits enable row level security;
alter table public.community_profile_moderation_audits force row level security;

drop policy if exists community_profiles_read on public.community_profiles;
create policy community_profiles_read on public.community_profiles for select using (
  id = auth.uid() or (current_user = 'authenticated' and public.community_is_admin())
  or (profile_state = 'published' and profile_moderation_state = 'visible')
  or exists (select 1 from public.community_posts p where p.author_id = community_profiles.id and p.audience = 'public' and p.publication_state = 'published' and p.moderation_state = 'visible' and public.community_launch_allows(true, false))
  or (public.community_launch_allows(false, true) and public.community_is_active_member())
);
create policy community_projects_read on public.community_projects for select using (
  owner_id = auth.uid() or (current_user = 'authenticated' and public.community_is_admin()) or exists (
    select 1 from public.community_profiles p where p.id = owner_id and p.profile_state = 'published' and p.profile_moderation_state = 'visible'
  )
);
create policy community_profile_moderation_audits_read_admin on public.community_profile_moderation_audits for select using (public.community_is_admin());

revoke all on public.community_projects, public.community_profile_moderation_audits from anon, authenticated;
revoke all on sequence public.community_profile_moderation_audits_id_seq from anon, authenticated;
revoke execute on function public.community_complete_profile(text, text), public.community_save_public_profile(text, text, text, text, text, text, text, text, jsonb), public.community_moderate_profile(uuid, text, text, uuid) from public, anon, authenticated;
grant select on public.community_projects to anon, authenticated;
grant select on public.community_profile_moderation_audits to authenticated;
grant execute on function public.community_complete_profile(text, text) to authenticated;
grant execute on function public.community_save_public_profile(text, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.community_moderate_profile(uuid, text, text, uuid) to authenticated;

comment on function public.community_save_public_profile(text, text, text, text, text, text, text, text, jsonb) is 'Atomically saves a verified user public profile and ordered project shelf.';
comment on function public.community_complete_profile(text, text) is 'Idempotently creates the minimal verified profile required before public profile editing.';
comment on function public.community_moderate_profile(uuid, text, text, uuid) is 'Idempotent admin-only profile moderation with an immutable audit record.';
