-- Community data and authorization boundary. The feature starts dark.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.community_launch_state (
  id boolean primary key default true check (id),
  writes_enabled boolean not null default false,
  private_reads_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.community_launch_state (id) values (true) on conflict (id) do nothing;

create table if not exists public.community_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict
);

create table if not exists public.community_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'suspended', 'revoked')),
  granted_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.community_admins(user_id) on delete restrict
);

create table if not exists public.community_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  author_id uuid not null references public.community_profiles(id) on delete restrict,
  audience text not null check (audience in ('public', 'members')),
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'deleted')),
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden')),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{12}$'),
  body_markdown text not null check (char_length(body_markdown) between 1 and 50000),
  github_repository_url text check (
    github_repository_url is null or
    github_repository_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'
  ),
  header_image_id uuid,
  header_enabled boolean not null default true,
  score integer not null default 0 check (score >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, author_id, audience),
  unique (id, audience),
  check ((publication_state = 'published') = (published_at is not null) or publication_state = 'deleted')
);

create table if not exists public.community_images (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null,
  author_id uuid not null references public.community_profiles(id) on delete restrict,
  audience text not null check (audience in ('public', 'members')),
  bucket_id text not null check (bucket_id in ('community-public', 'community-private', 'community-staging')),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  width integer check (width > 0),
  height integer check (height > 0),
  -- Negative positions are reserved for the first phase of the atomic reorder RPC.
  position smallint not null check (position between -5 and 4),
  state text not null default 'staging' check (state in ('staging', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  unique (id, post_id, audience),
  foreign key (post_id, author_id, audience)
    references public.community_posts(id, author_id, audience) on delete cascade,
  check (
    (state = 'staging' and bucket_id = 'community-staging') or
    (state = 'deleted') or
    (state = 'ready' and (
      (audience = 'public' and bucket_id = 'community-public') or
      (audience = 'members' and bucket_id = 'community-private')
    ))
  )
);

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.community_posts'::regclass
      and conname = 'community_posts_header_image_fk'
  ) then
    alter table public.community_posts
      add constraint community_posts_header_image_fk
      foreign key (header_image_id, id, audience)
      references public.community_images(id, post_id, audience)
      on delete restrict;
  end if;
end
$constraint$;

create table if not exists public.community_replies (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null,
  author_id uuid not null references public.community_profiles(id) on delete restrict,
  audience text not null check (audience in ('public', 'members')),
  body_markdown text not null check (char_length(body_markdown) between 1 and 10000),
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden')),
  score integer not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, post_id),
  foreign key (post_id, audience) references public.community_posts(id, audience) on delete cascade
);

create table if not exists public.community_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.community_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_post_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  post_count integer not null check (post_count >= 0)
);

create table if not exists public.community_upload_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  sign_count integer not null check (sign_count >= 0),
  declared_bytes bigint not null check (declared_bytes >= 0)
);

create table if not exists public.community_membership_audits (
  id bigint generated always as identity primary key,
  request_id uuid not null default extensions.gen_random_uuid() unique,
  actor_id uuid not null references public.community_admins(user_id) on delete restrict,
  subject_id uuid not null references auth.users(id) on delete restrict,
  previous_status text,
  new_status text not null check (new_status in ('active', 'suspended', 'revoked')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.community_moderation_audits (
  id bigint generated always as identity primary key,
  request_id uuid not null default extensions.gen_random_uuid() unique,
  actor_id uuid not null references public.community_admins(user_id) on delete restrict,
  content_type text not null check (content_type in ('post', 'reply')),
  content_id uuid not null,
  previous_state text not null check (previous_state in ('visible', 'hidden')),
  new_state text not null check (new_state in ('visible', 'hidden')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.community_launch_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.community_admins(user_id) on delete restrict,
  previous_writes_enabled boolean not null,
  new_writes_enabled boolean not null,
  previous_private_reads_enabled boolean not null,
  new_private_reads_enabled boolean not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists community_posts_feed_idx
  on public.community_posts (audience, publication_state, moderation_state, published_at desc, id desc);
create index if not exists community_replies_post_idx
  on public.community_replies (post_id, created_at, id);
create index if not exists community_images_post_idx
  on public.community_images (post_id, state, position);
create unique index if not exists community_images_live_position_idx
  on public.community_images (post_id, position) where state <> 'deleted';

create or replace function public.community_is_admin(subject uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select subject is not null and exists (
    select 1 from public.community_admins a where a.user_id = subject
  );
$$;

create or replace function public.community_is_active_member(subject uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select subject is not null and (
    public.community_is_admin(subject) or exists (
      select 1 from public.community_memberships m
      where m.user_id = subject and m.status = 'active'
    )
  );
$$;

create or replace function public.community_launch_allows(requested_write boolean, requested_private boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.community_launch_state s
    where s.id
      and (not requested_write or s.writes_enabled)
      and (not requested_private or s.private_reads_enabled)
  );
$$;

create or replace function public.community_can_access_audience(requested_audience text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case requested_audience
    when 'public' then true
    when 'members' then public.community_launch_allows(false, true)
      and public.community_is_active_member(auth.uid())
    else false
  end;
$$;

create or replace function public.community_random_slug(title_input text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  fragment text;
begin
  fragment := trim(both '-' from regexp_replace(lower(coalesce(title_input, 'post')), '[^a-z0-9]+', '-', 'g'));
  fragment := trim(both '-' from left(coalesce(nullif(fragment, ''), 'post'), 72));
  return fragment || '-' || encode(extensions.gen_random_bytes(6), 'hex');
end;
$$;

create or replace function public.community_reject_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'community audit rows are immutable' using errcode = '42501';
end;
$$;

drop trigger if exists community_membership_audits_immutable on public.community_membership_audits;
create trigger community_membership_audits_immutable before update or delete on public.community_membership_audits
  for each row execute function public.community_reject_audit_mutation();
drop trigger if exists community_moderation_audits_immutable on public.community_moderation_audits;
create trigger community_moderation_audits_immutable before update or delete on public.community_moderation_audits
  for each row execute function public.community_reject_audit_mutation();
drop trigger if exists community_launch_audits_immutable on public.community_launch_audits;
create trigger community_launch_audits_immutable before update or delete on public.community_launch_audits
  for each row execute function public.community_reject_audit_mutation();

create or replace function public.community_default_header()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.state = 'ready' and (tg_op = 'INSERT' or old.state is distinct from new.state) then
    update public.community_posts
      set header_image_id = new.id, updated_at = clock_timestamp()
      where id = new.post_id and publication_state = 'draft' and header_enabled and header_image_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists community_images_default_header on public.community_images;
create trigger community_images_default_header after insert or update of state on public.community_images
  for each row execute function public.community_default_header();

create or replace function public.community_consume_post_rate_limit()
returns void language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_count integer;
begin
  if actor is null or not public.community_launch_allows(true, false) then
    raise exception 'community write unavailable' using errcode = '42501';
  end if;
  insert into public.community_post_rate_limits (user_id, window_started_at, post_count)
  values (actor, clock_timestamp(), 1)
  on conflict (user_id) do update set
    window_started_at = case
      when public.community_post_rate_limits.window_started_at <= clock_timestamp() - interval '1 hour'
        then clock_timestamp() else public.community_post_rate_limits.window_started_at end,
    post_count = case
      when public.community_post_rate_limits.window_started_at <= clock_timestamp() - interval '1 hour'
        then 1 else public.community_post_rate_limits.post_count + 1 end
  returning post_count into current_count;
  if current_count > 5 then
    raise exception 'post creation rate limit exceeded' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.community_consume_upload_quota(declared_byte_size_input bigint)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_count integer; current_bytes bigint;
begin
  if actor is null or not public.community_launch_allows(true, false) then
    raise exception 'community write unavailable' using errcode = '42501';
  end if;
  if declared_byte_size_input not between 1 and 5242880 then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;
  insert into public.community_upload_rate_limits (user_id, window_started_at, sign_count, declared_bytes)
  values (actor, clock_timestamp(), 1, declared_byte_size_input)
  on conflict (user_id) do update set
    window_started_at = case
      when public.community_upload_rate_limits.window_started_at <= clock_timestamp() - interval '1 hour'
        then clock_timestamp() else public.community_upload_rate_limits.window_started_at end,
    sign_count = case
      when public.community_upload_rate_limits.window_started_at <= clock_timestamp() - interval '1 hour'
        then 1 else public.community_upload_rate_limits.sign_count + 1 end,
    declared_bytes = case
      when public.community_upload_rate_limits.window_started_at <= clock_timestamp() - interval '1 hour'
        then declared_byte_size_input else public.community_upload_rate_limits.declared_bytes + declared_byte_size_input end
  returning sign_count, declared_bytes into current_count, current_bytes;
  if current_count > 12 or current_bytes > 26214400 then
    raise exception 'upload quota exceeded' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.community_create_post(
  title_input text, body_input text, audience_input text, github_repository_input text default null
) returns public.community_posts
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.community_posts;
begin
  if actor is null or not exists (
    select 1 from auth.users u join public.community_profiles p on p.id = u.id
    where u.id = actor and u.email_confirmed_at is not null
  ) then raise exception 'verified community profile required' using errcode = '42501'; end if;
  if audience_input not in ('public', 'members') or
     (audience_input = 'members' and not public.community_is_active_member(actor)) then
    raise exception 'community audience unavailable' using errcode = '42501';
  end if;
  if audience_input = 'members' and not public.community_launch_allows(true, true) then
    raise exception 'community audience unavailable' using errcode = '42501';
  end if;
  if btrim(coalesce(title_input, '')) = '' or btrim(coalesce(body_input, '')) = '' then
    raise exception 'title and body are required' using errcode = '22023';
  end if;
  if github_repository_input is not null and github_repository_input !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' then
    raise exception 'invalid GitHub repository URL' using errcode = '22023';
  end if;
  perform public.community_consume_post_rate_limit();
  insert into public.community_posts (author_id, audience, title, slug, body_markdown, github_repository_url)
  values (actor, audience_input, btrim(title_input), public.community_random_slug(title_input), body_input,
    nullif(regexp_replace(github_repository_input, '/$', ''), ''))
  returning * into created;
  return created;
end;
$$;

create or replace function public.community_publish_post(post_input uuid)
returns public.community_posts language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.community_posts;
begin
  select * into target from public.community_posts p where p.id = post_input for update;
  if target.id is null or target.author_id <> actor or target.publication_state = 'deleted' then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if target.publication_state = 'published' then return target; end if;
  if not public.community_launch_allows(true, target.audience = 'members') or
     (target.audience = 'members' and not public.community_is_active_member(actor)) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if exists (select 1 from public.community_images i where i.post_id = target.id and i.state = 'staging') then
    raise exception 'images are still processing' using errcode = 'P0001';
  end if;
  update public.community_posts set publication_state = 'published', published_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = target.id returning * into target;
  return target;
end;
$$;

create or replace function public.community_update_post(
  post_input uuid, title_input text, body_input text, github_repository_input text default null
) returns public.community_posts
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.community_posts;
begin
  select * into target from public.community_posts p where p.id = post_input for update;
  if actor is null or target.id is null or target.author_id <> actor
     or target.publication_state = 'deleted' or target.moderation_state <> 'visible'
     or not public.community_launch_allows(true, target.audience = 'members')
     or (target.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if btrim(coalesce(title_input, '')) = '' or btrim(coalesce(body_input, '')) = '' then
    raise exception 'title and body are required' using errcode = '22023';
  end if;
  if github_repository_input is not null and github_repository_input !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' then
    raise exception 'invalid GitHub repository URL' using errcode = '22023';
  end if;
  update public.community_posts set
    title = btrim(title_input),
    body_markdown = body_input,
    github_repository_url = nullif(regexp_replace(github_repository_input, '/$', ''), ''),
    updated_at = clock_timestamp()
  where id = target.id
  returning * into target;
  return target;
end;
$$;

create or replace function public.community_delete_post(post_input uuid)
returns public.community_posts language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.community_posts;
begin
  select * into target from public.community_posts p where p.id = post_input for update;
  if actor is null or target.id is null or target.author_id <> actor
     or not public.community_launch_allows(true, target.audience = 'members')
     or (target.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if target.publication_state = 'deleted' then return target; end if;
  update public.community_posts set
    publication_state = 'deleted', deleted_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = target.id
  returning * into target;
  return target;
end;
$$;

create or replace function public.community_create_reply(post_input uuid, body_input text)
returns public.community_replies language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); parent public.community_posts; created public.community_replies;
begin
  select * into parent from public.community_posts p where p.id = post_input for update;
  if actor is null or parent.id is null or parent.publication_state <> 'published' or parent.moderation_state <> 'visible'
     or not public.community_launch_allows(true, parent.audience = 'members')
     or not public.community_can_access_audience(parent.audience)
     or not exists (select 1 from public.community_profiles p where p.id = actor) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if btrim(coalesce(body_input, '')) = '' then raise exception 'reply body is required' using errcode = '22023'; end if;
  insert into public.community_replies (post_id, author_id, audience, body_markdown)
  values (parent.id, actor, parent.audience, body_input) returning * into created;
  update public.community_posts set reply_count = reply_count + 1 where id = parent.id;
  return created;
end;
$$;

create or replace function public.community_toggle_vote(post_input uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); parent public.community_posts;
begin
  select * into parent from public.community_posts p where p.id = post_input for update;
  if actor is null or parent.id is null or parent.publication_state <> 'published' or parent.moderation_state <> 'visible'
     or not public.community_launch_allows(true, parent.audience = 'members')
     or not public.community_can_access_audience(parent.audience)
     or not exists (select 1 from public.community_profiles p where p.id = actor) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  delete from public.community_votes where post_id = parent.id and user_id = actor;
  if found then
    update public.community_posts set score = greatest(0, score - 1) where id = parent.id;
    return false;
  end if;
  insert into public.community_votes (post_id, user_id) values (parent.id, actor);
  update public.community_posts set score = score + 1 where id = parent.id;
  return true;
end;
$$;

create or replace function public.community_set_post_header(post_input uuid, image_input uuid, enabled_input boolean)
returns public.community_posts language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.community_posts;
begin
  select * into target from public.community_posts p where p.id = post_input for update;
  if target.id is null or target.author_id <> actor or target.publication_state <> 'draft'
     or target.moderation_state <> 'visible'
     or not public.community_launch_allows(true, target.audience = 'members')
     or (target.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if enabled_input and image_input is not null and not exists (
    select 1 from public.community_images i where i.id = image_input and i.post_id = target.id
      and i.audience = target.audience and i.state = 'ready'
  ) then raise exception 'header image unavailable' using errcode = '42501'; end if;
  update public.community_posts set
    header_enabled = enabled_input,
    header_image_id = case when enabled_input then image_input else null end,
    updated_at = clock_timestamp()
  where id = target.id returning * into target;
  return target;
end;
$$;

create or replace function public.community_begin_image(
  post_input uuid, mime_type_input text, declared_byte_size_input bigint
)
returns public.community_images language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.community_posts;
  created public.community_images;
  image_id uuid := extensions.gen_random_uuid();
  next_position smallint;
  file_extension text;
begin
  select * into target from public.community_posts p where p.id = post_input for update;
  if actor is null or target.id is null or target.author_id <> actor or target.publication_state <> 'draft'
     or target.moderation_state <> 'visible'
     or not public.community_launch_allows(true, target.audience = 'members')
     or (target.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  file_extension := case mime_type_input
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else null end;
  if file_extension is null then raise exception 'invalid image metadata' using errcode = '22023'; end if;
  if declared_byte_size_input not between 1 and 5242880 then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;
  if (select count(*) from public.community_images i where i.post_id = target.id and i.state <> 'deleted') >= 5 then
    raise exception 'image limit exceeded' using errcode = 'P0001';
  end if;
  select slot::smallint into next_position
  from generate_series(0, 4) slot
  where not exists (
    select 1 from public.community_images i
    where i.post_id = target.id and i.position = slot and i.state <> 'deleted'
  ) order by slot limit 1;
  perform public.community_consume_upload_quota(declared_byte_size_input);
  insert into public.community_images (
    id, post_id, author_id, audience, bucket_id, object_path, mime_type, byte_size, position, state
  ) values (
    image_id, target.id, actor, target.audience, 'community-staging',
    actor::text || '/' || target.id::text || '/' || image_id::text || '.' || file_extension,
    mime_type_input, declared_byte_size_input, next_position, 'staging'
  ) returning * into created;
  return created;
end;
$$;

create or replace function public.community_finalize_image(
  image_input uuid, mime_type_input text, byte_size_input bigint, width_input integer, height_input integer
) returns public.community_images language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.community_images; parent public.community_posts; destination text;
begin
  select * into target from public.community_images i where i.id = image_input;
  if target.id is null or target.author_id <> actor then raise exception 'image unavailable' using errcode = '42501'; end if;
  select * into parent from public.community_posts p where p.id = target.post_id for update;
  select * into target from public.community_images i where i.id = image_input for update;
  if parent.id is null or parent.author_id <> actor or parent.publication_state <> 'draft'
     or parent.moderation_state <> 'visible' or parent.audience <> target.audience
     or not public.community_launch_allows(true, parent.audience = 'members')
     or (parent.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then raise exception 'image unavailable' using errcode = '42501'; end if;
  if mime_type_input not in ('image/jpeg', 'image/png', 'image/webp') or mime_type_input <> target.mime_type
     or byte_size_input not between 1 and 5242880
     or width_input not between 1 and 16384 or height_input not between 1 and 16384
     or width_input::bigint * height_input::bigint > 100000000 then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;
  destination := case parent.audience when 'public' then 'community-public' else 'community-private' end;
  if target.state = 'ready' then
    if target.bucket_id = destination and target.mime_type = mime_type_input and target.byte_size = byte_size_input
       and target.width = width_input and target.height = height_input then return target; end if;
    raise exception 'image finalization mismatch' using errcode = '22023';
  end if;
  if target.state <> 'staging' or target.bucket_id <> 'community-staging' then
    raise exception 'image unavailable' using errcode = '42501';
  end if;
  update public.community_images set bucket_id = destination, mime_type = mime_type_input,
    byte_size = byte_size_input, width = width_input, height = height_input, state = 'ready'
  where id = target.id returning * into target;
  return target;
end;
$$;

create or replace function public.community_delete_image(image_input uuid)
returns public.community_images language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.community_images; parent public.community_posts;
begin
  select * into target from public.community_images i where i.id = image_input;
  if target.id is null or target.author_id <> actor then raise exception 'image unavailable' using errcode = '42501'; end if;
  select * into parent from public.community_posts p where p.id = target.post_id for update;
  select * into target from public.community_images i where i.id = image_input for update;
  if parent.id is null or parent.author_id <> actor or parent.publication_state <> 'draft'
     or parent.moderation_state <> 'visible'
     or not public.community_launch_allows(true, parent.audience = 'members')
     or (parent.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then
    raise exception 'image unavailable' using errcode = '42501';
  end if;
  if target.state = 'deleted' then return target; end if;
  update public.community_posts set header_image_id = null, updated_at = clock_timestamp()
    where id = parent.id and header_image_id = target.id;
  update public.community_images set state = 'deleted' where id = target.id returning * into target;
  return target;
end;
$$;

create or replace function public.community_reorder_images(post_input uuid, image_ids_input uuid[])
returns setof public.community_images language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); parent public.community_posts; supplied_count integer := coalesce(cardinality(image_ids_input), 0);
begin
  select * into parent from public.community_posts p where p.id = post_input for update;
  if parent.id is null or parent.author_id <> actor or parent.publication_state <> 'draft'
     or parent.moderation_state <> 'visible'
     or not public.community_launch_allows(true, parent.audience = 'members')
     or (parent.audience = 'members' and not public.community_is_active_member(actor))
     or not exists (
       select 1 from auth.users u join public.community_profiles p on p.id = u.id
       where u.id = actor and u.email_confirmed_at is not null
     ) then
    raise exception 'post unavailable' using errcode = '42501';
  end if;
  if supplied_count < 1 or supplied_count > 5
     or (select count(distinct value) from unnest(image_ids_input) value) <> supplied_count
     or (select count(*) from public.community_images i where i.post_id = parent.id and i.state <> 'deleted') <> supplied_count
     or exists (
       select 1 from unnest(image_ids_input) value
       where not exists (
         select 1 from public.community_images i where i.id = value and i.post_id = parent.id
           and i.author_id = actor and i.audience = parent.audience and i.state <> 'deleted'
       )
     ) then raise exception 'invalid image order' using errcode = '22023'; end if;
  update public.community_images i set position = position - 5
  where i.post_id = parent.id and i.state <> 'deleted';
  update public.community_images i set position = array_position(image_ids_input, i.id) - 1
  where i.post_id = parent.id and i.state <> 'deleted';
  return query select i.* from public.community_images i
    where i.post_id = parent.id and i.state <> 'deleted' order by i.position;
end;
$$;

create or replace function public.community_set_membership(
  subject_input uuid, status_input text, reason_input text,
  request_id_input uuid default extensions.gen_random_uuid()
)
returns public.community_memberships language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); old_status text; changed public.community_memberships; prior public.community_membership_audits;
begin
  if not public.community_is_admin(actor) then raise exception 'admin required' using errcode = '42501'; end if;
  if not public.community_launch_allows(true, false) then raise exception 'community write unavailable' using errcode = '42501'; end if;
  if status_input not in ('active', 'suspended', 'revoked') or btrim(coalesce(reason_input, '')) = '' then
    raise exception 'invalid membership change' using errcode = '22023';
  end if;
  if request_id_input is null then raise exception 'request id required' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id_input::text, 0));
  select * into prior from public.community_membership_audits where request_id = request_id_input;
  if prior.id is not null then
    if prior.actor_id <> actor or prior.subject_id <> subject_input or prior.new_status <> status_input
       or prior.reason <> btrim(reason_input) then
      raise exception 'request id reuse mismatch' using errcode = '22023';
    end if;
    select * into changed from public.community_memberships where user_id = subject_input;
    return changed;
  end if;
  select status into old_status from public.community_memberships where user_id = subject_input for update;
  insert into public.community_memberships (user_id, status, granted_at, updated_at, updated_by)
  values (subject_input, status_input, case when status_input = 'active' then clock_timestamp() end, clock_timestamp(), actor)
  on conflict (user_id) do update set status = excluded.status,
    granted_at = case when excluded.status = 'active' then coalesce(public.community_memberships.granted_at, clock_timestamp()) else public.community_memberships.granted_at end,
    updated_at = clock_timestamp(), updated_by = actor
  returning * into changed;
  insert into public.community_membership_audits (request_id, actor_id, subject_id, previous_status, new_status, reason)
  values (request_id_input, actor, subject_input, old_status, status_input, btrim(reason_input));
  return changed;
end;
$$;

create or replace function public.community_moderate_content(
  content_type_input text, content_input uuid, state_input text, reason_input text,
  request_id_input uuid default extensions.gen_random_uuid()
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); old_state text; prior public.community_moderation_audits;
begin
  if not public.community_is_admin(actor) then raise exception 'admin required' using errcode = '42501'; end if;
  if not public.community_launch_allows(true, false) then raise exception 'community write unavailable' using errcode = '42501'; end if;
  if state_input not in ('visible', 'hidden') or content_type_input not in ('post', 'reply')
     or btrim(coalesce(reason_input, '')) = '' then raise exception 'invalid moderation change' using errcode = '22023'; end if;
  if request_id_input is null then raise exception 'request id required' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id_input::text, 0));
  select * into prior from public.community_moderation_audits where request_id = request_id_input;
  if prior.id is not null then
    if prior.actor_id <> actor or prior.content_type <> content_type_input or prior.content_id <> content_input
       or prior.new_state <> state_input or prior.reason <> btrim(reason_input) then
      raise exception 'request id reuse mismatch' using errcode = '22023';
    end if;
    return;
  end if;
  if content_type_input = 'post' then
    select moderation_state into old_state from public.community_posts where id = content_input for update;
    update public.community_posts set moderation_state = state_input, updated_at = clock_timestamp() where id = content_input;
  else
    select moderation_state into old_state from public.community_replies where id = content_input for update;
    update public.community_replies set moderation_state = state_input, updated_at = clock_timestamp() where id = content_input;
  end if;
  if old_state is null then raise exception 'content unavailable' using errcode = '42501'; end if;
  insert into public.community_moderation_audits (request_id, actor_id, content_type, content_id, previous_state, new_state, reason)
  values (request_id_input, actor, content_type_input, content_input, old_state, state_input, btrim(reason_input));
end;
$$;

create or replace function public.community_set_launch_state(writes_input boolean, private_reads_input boolean, reason_input text)
returns public.community_launch_state language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); previous public.community_launch_state; changed public.community_launch_state;
begin
  if not public.community_is_admin(actor) then raise exception 'admin required' using errcode = '42501'; end if;
  if btrim(coalesce(reason_input, '')) = '' then raise exception 'launch reason required' using errcode = '22023'; end if;
  select * into previous from public.community_launch_state where id for update;
  update public.community_launch_state set writes_enabled = writes_input,
    private_reads_enabled = private_reads_input, updated_at = clock_timestamp(), updated_by = actor
  where id returning * into changed;
  insert into public.community_launch_audits (
    actor_id, previous_writes_enabled, new_writes_enabled,
    previous_private_reads_enabled, new_private_reads_enabled, reason
  ) values (actor, previous.writes_enabled, writes_input, previous.private_reads_enabled, private_reads_input, btrim(reason_input));
  return changed;
end;
$$;

-- RLS is force-enabled so table owners cannot accidentally rely on bypass behavior.
alter table public.community_launch_state enable row level security;
alter table public.community_profiles enable row level security;
alter table public.community_admins enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_images enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_votes enable row level security;
alter table public.community_post_rate_limits enable row level security;
alter table public.community_upload_rate_limits enable row level security;
alter table public.community_membership_audits enable row level security;
alter table public.community_moderation_audits enable row level security;
alter table public.community_launch_audits enable row level security;
alter table public.community_launch_state force row level security;
alter table public.community_profiles force row level security;
alter table public.community_admins force row level security;
alter table public.community_memberships force row level security;
alter table public.community_posts force row level security;
alter table public.community_images force row level security;
alter table public.community_replies force row level security;
alter table public.community_votes force row level security;
alter table public.community_post_rate_limits force row level security;
alter table public.community_upload_rate_limits force row level security;
alter table public.community_membership_audits force row level security;
alter table public.community_moderation_audits force row level security;
alter table public.community_launch_audits force row level security;

drop policy if exists community_profiles_read on public.community_profiles;
drop policy if exists community_profiles_insert_self on public.community_profiles;
drop policy if exists community_profiles_update_self on public.community_profiles;
drop policy if exists community_admins_read_self on public.community_admins;
drop policy if exists community_memberships_read_self_or_admin on public.community_memberships;
drop policy if exists community_posts_read on public.community_posts;
drop policy if exists community_images_read on public.community_images;
drop policy if exists community_replies_read on public.community_replies;
drop policy if exists community_votes_read_self on public.community_votes;
drop policy if exists community_membership_audits_read_admin on public.community_membership_audits;
drop policy if exists community_moderation_audits_read_admin on public.community_moderation_audits;
drop policy if exists community_launch_audits_read_admin on public.community_launch_audits;

create policy community_profiles_read on public.community_profiles for select using (
  community_profiles.id = auth.uid() or public.community_is_admin() or exists (
    select 1 from public.community_posts p where p.author_id = community_profiles.id and p.audience = 'public'
      and p.publication_state = 'published' and p.moderation_state = 'visible'
  ) or (public.community_launch_allows(false, true) and public.community_is_active_member())
);
create policy community_profiles_insert_self on public.community_profiles for insert with check (
  id = auth.uid() and public.community_launch_allows(true, false) and exists (
    select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
  )
);
create policy community_profiles_update_self on public.community_profiles for update using (
  id = auth.uid() and public.community_launch_allows(true, false)
) with check (id = auth.uid());
create policy community_admins_read_self on public.community_admins for select using (user_id = auth.uid());
create policy community_memberships_read_self_or_admin on public.community_memberships for select using (
  user_id = auth.uid() or public.community_is_admin()
);
create policy community_posts_read on public.community_posts for select using (
  (audience = 'public' and publication_state = 'published' and moderation_state = 'visible') or
  (audience = 'members' and publication_state = 'published' and moderation_state = 'visible'
    and public.community_launch_allows(false, true) and public.community_is_active_member()) or
  (author_id = auth.uid() and (audience = 'public' or (
    public.community_launch_allows(false, true) and public.community_is_active_member()
  )))
);
create policy community_images_read on public.community_images for select using (
  exists (select 1 from public.community_posts p where p.id = post_id and (
    (p.audience = 'public' and p.publication_state = 'published' and p.moderation_state = 'visible' and state = 'ready') or
    (p.audience = 'members' and p.publication_state = 'published' and p.moderation_state = 'visible'
      and state = 'ready' and public.community_launch_allows(false, true) and public.community_is_active_member()) or
    (p.author_id = auth.uid() and (p.audience = 'public' or (
      public.community_launch_allows(false, true) and public.community_is_active_member()
    )))
  ))
);
create policy community_replies_read on public.community_replies for select using (
  moderation_state = 'visible' and deleted_at is null and exists (
    select 1 from public.community_posts p where p.id = post_id and p.publication_state = 'published'
      and p.moderation_state = 'visible' and public.community_can_access_audience(p.audience)
  )
);
create policy community_votes_read_self on public.community_votes for select using (user_id = auth.uid());
create policy community_membership_audits_read_admin on public.community_membership_audits for select using (public.community_is_admin());
create policy community_moderation_audits_read_admin on public.community_moderation_audits for select using (public.community_is_admin());
create policy community_launch_audits_read_admin on public.community_launch_audits for select using (public.community_is_admin());

-- Deny by default at the grant layer. Mutations happen through the audited functions above.
revoke all on public.community_launch_state, public.community_profiles, public.community_admins,
  public.community_memberships, public.community_posts, public.community_images, public.community_replies,
  public.community_votes, public.community_post_rate_limits, public.community_membership_audits,
  public.community_upload_rate_limits, public.community_moderation_audits,
  public.community_launch_audits from anon, authenticated;
revoke all on sequence public.community_membership_audits_id_seq,
  public.community_moderation_audits_id_seq, public.community_launch_audits_id_seq from anon, authenticated;
revoke execute on function public.community_is_admin(uuid), public.community_is_active_member(uuid),
  public.community_launch_allows(boolean, boolean), public.community_can_access_audience(text),
  public.community_random_slug(text), public.community_consume_post_rate_limit(),
  public.community_consume_upload_quota(bigint),
  public.community_create_post(text, text, text, text), public.community_publish_post(uuid),
  public.community_update_post(uuid, text, text, text), public.community_delete_post(uuid),
  public.community_create_reply(uuid, text), public.community_toggle_vote(uuid),
  public.community_set_post_header(uuid, uuid, boolean), public.community_begin_image(uuid, text, bigint),
  public.community_finalize_image(uuid, text, bigint, integer, integer), public.community_delete_image(uuid),
  public.community_reorder_images(uuid, uuid[]), public.community_set_membership(uuid, text, text, uuid),
  public.community_moderate_content(text, uuid, text, text, uuid),
  public.community_set_launch_state(boolean, boolean, text) from public, anon, authenticated;
grant select on public.community_profiles, public.community_posts, public.community_images, public.community_replies to anon, authenticated;
grant select on public.community_admins, public.community_memberships, public.community_votes to authenticated;
grant select on public.community_membership_audits, public.community_moderation_audits, public.community_launch_audits to authenticated;
grant insert (id, first_name, last_name) on public.community_profiles to authenticated;
grant update (first_name, last_name, updated_at) on public.community_profiles to authenticated;
grant execute on function public.community_create_post(text, text, text, text) to authenticated;
grant execute on function public.community_publish_post(uuid) to authenticated;
grant execute on function public.community_update_post(uuid, text, text, text) to authenticated;
grant execute on function public.community_delete_post(uuid) to authenticated;
grant execute on function public.community_create_reply(uuid, text) to authenticated;
grant execute on function public.community_toggle_vote(uuid) to authenticated;
grant execute on function public.community_set_post_header(uuid, uuid, boolean) to authenticated;
grant execute on function public.community_begin_image(uuid, text, bigint) to authenticated;
grant execute on function public.community_finalize_image(uuid, text, bigint, integer, integer) to authenticated;
grant execute on function public.community_delete_image(uuid) to authenticated;
grant execute on function public.community_reorder_images(uuid, uuid[]) to authenticated;
grant execute on function public.community_set_membership(uuid, text, text, uuid) to authenticated;
grant execute on function public.community_moderate_content(text, uuid, text, text, uuid) to authenticated;
grant execute on function public.community_set_launch_state(boolean, boolean, text) to authenticated;
grant execute on function public.community_is_admin(uuid), public.community_is_active_member(uuid),
  public.community_launch_allows(boolean, boolean), public.community_can_access_audience(text) to anon, authenticated;

-- Keep the existing application forms operating while the dormant forum remains unreachable.
grant insert on public.applications, public.global_waitlist to anon, authenticated;
revoke all on public.profiles, public.threads, public.posts, public.tags, public.thread_tags,
  public.votes, public.challenges, public.build_submissions, public.reports from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('community-public', 'community-public', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-private', 'community-private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-staging', 'community-staging', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_public_media_read on storage.objects;
drop policy if exists community_private_media_read on storage.objects;
drop policy if exists community_staging_media_owner_read on storage.objects;
drop policy if exists community_staging_media_owner_insert on storage.objects;

create policy community_public_media_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'community-public' and exists (
    select 1 from public.community_images i join public.community_posts p on p.id = i.post_id
    where i.bucket_id = storage.objects.bucket_id and i.object_path = storage.objects.name
      and i.state = 'ready' and p.audience = 'public' and p.publication_state = 'published'
      and p.moderation_state = 'visible'
  )
);
create policy community_private_media_read on storage.objects for select to authenticated using (
  bucket_id = 'community-private' and public.community_launch_allows(false, true)
    and public.community_is_active_member() and exists (
      select 1 from public.community_images i join public.community_posts p on p.id = i.post_id
      where i.bucket_id = storage.objects.bucket_id and i.object_path = storage.objects.name
        and i.state = 'ready' and p.audience = 'members' and p.publication_state = 'published'
        and p.moderation_state = 'visible'
    )
);
create policy community_staging_media_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'community-staging' and (storage.foldername(name))[1] = auth.uid()::text
    and public.community_launch_allows(true, false)
);
create policy community_staging_media_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'community-staging' and (storage.foldername(name))[1] = auth.uid()::text
    and public.community_launch_allows(true, false)
    and exists (
      select 1 from public.community_posts p
      where p.id::text = (storage.foldername(name))[2] and p.author_id = auth.uid()
        and p.publication_state = 'draft'
        and (p.audience = 'public' or public.community_is_active_member())
    )
    and coalesce((metadata ->> 'mimetype') in ('image/jpeg', 'image/png', 'image/webp'), false)
);

revoke all on storage.objects, storage.buckets from anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;

comment on table public.community_admins is 'Bootstrapped only by an operator migration or SQL runbook. No product function grants admin status.';
comment on table public.community_launch_state is 'Singleton database feature gate. Writes and private reads start disabled.';
comment on function public.community_set_membership(uuid, text, text, uuid) is 'Atomic idempotent admin-only membership transition with immutable audit.';
comment on function public.community_publish_post(uuid) is 'Idempotent author publication guarded by launch and audience state.';
comment on function public.community_update_post(uuid, text, text, text) is 'Author-only content edit that cannot modify ownership, audience, moderation, state, or counters.';
comment on function public.community_delete_post(uuid) is 'Idempotent author-only soft deletion guarded by current launch and audience eligibility.';
