begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_table('public', 'community_profiles');
select extensions.has_table('public', 'community_admins');
select extensions.has_table('public', 'community_memberships');
select extensions.has_table('public', 'community_posts');
select extensions.has_table('public', 'community_images');
select extensions.has_table('public', 'community_replies');
select extensions.has_table('public', 'community_votes');
select extensions.has_table('public', 'community_launch_state');
select extensions.has_table('public', 'community_membership_audits');
select extensions.has_table('public', 'community_moderation_audits');

select extensions.has_function('public', 'community_is_admin', array['uuid']);
select extensions.has_function('public', 'community_is_active_member', array['uuid']);
select extensions.has_function('public', 'community_random_slug', array['text']);
select extensions.has_function('public', 'community_create_post', array['text', 'text', 'text', 'text']);
select extensions.has_function('public', 'community_publish_post', array['uuid']);
select extensions.has_function('public', 'community_create_reply', array['uuid', 'text']);
select extensions.has_function('public', 'community_toggle_vote', array['uuid']);
select extensions.has_function('public', 'community_set_membership', array['uuid', 'text', 'text']);
select extensions.has_function('public', 'community_moderate_content', array['text', 'uuid', 'text', 'text']);
select extensions.has_function('public', 'community_set_post_header', array['uuid', 'uuid', 'boolean']);
select extensions.has_function('public', 'community_set_launch_state', array['boolean', 'boolean', 'text']);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.community_posts'::regclass),
  'community posts have RLS enabled'
);
select extensions.ok(
  (select relforcerowsecurity from pg_class where oid = 'public.community_posts'::regclass),
  'community posts force RLS for table owners'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.community_memberships', 'select'),
  'anonymous users cannot inspect membership rows'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_admins', 'insert'),
  'product roles cannot grant admin status'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_membership_audits', 'insert'),
  'membership audits are function-owned'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_moderation_audits', 'update'),
  'moderation audits are immutable to product roles'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.community_publish_post(uuid)'::regprocedure),
  'publish uses a fixed empty search path'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.community_set_membership(uuid,text,text)'::regprocedure),
  'membership mutation uses a fixed empty search path'
);
select extensions.is(
  (select count(*)::integer from storage.buckets
    where id in ('community-public', 'community-private', 'community-staging')),
  3,
  'all three community buckets exist'
);
select extensions.is(
  (select public from storage.buckets where id = 'community-public'),
  true,
  'only finalized public media uses a public bucket'
);
select extensions.is(
  (select public from storage.buckets where id = 'community-private'),
  false,
  'member media remains private'
);
select extensions.is(
  (select public from storage.buckets where id = 'community-staging'),
  false,
  'staging media remains private'
);
select extensions.is(
  (select writes_enabled from public.community_launch_state where id = true),
  false,
  'community writes start dark'
);
select extensions.is(
  (select private_reads_enabled from public.community_launch_state where id = true),
  false,
  'community private reads start dark'
);

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', now(), '{}', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member@example.test', now(), '{}', '{}'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'contributor@example.test', now(), '{}', '{}'),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'newcomer@example.test', now(), '{}', '{}');
insert into public.community_profiles (id, first_name, last_name) values
  ('10000000-0000-0000-0000-000000000001', 'Ada', 'Admin'),
  ('10000000-0000-0000-0000-000000000002', 'Mina', 'Member'),
  ('10000000-0000-0000-0000-000000000003', 'Connie', 'Contributor'),
  ('10000000-0000-0000-0000-000000000004', 'Nora', 'Newcomer');
insert into public.community_admins (user_id) values ('10000000-0000-0000-0000-000000000001');
insert into public.community_memberships (user_id, status, granted_at, updated_by)
values ('10000000-0000-0000-0000-000000000002', 'active', now(), '10000000-0000-0000-0000-000000000001');
insert into public.community_posts (
  id, author_id, audience, publication_state, title, slug, body_markdown, moderation_state, published_at
) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'public', 'published', 'Public proof', 'public-proof-a1b2c3d4e5f6', 'Visible', 'visible', now()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'members', 'published', 'Private proof', 'private-proof-f6e5d4c3b2a1', 'Secret', 'visible', now());
insert into public.community_images (
  id, post_id, author_id, audience, bucket_id, object_path, mime_type, byte_size, position, state
) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'public', 'community-public', 'public.jpg', 'image/jpeg', 100, 0, 'ready'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'members', 'community-private', 'private.jpg', 'image/jpeg', 100, 0, 'ready');

set local role anon;
select extensions.is((select count(*)::integer from public.community_posts), 1, 'anonymous sees only the public post');
select extensions.is((select count(*)::integer from public.community_images), 1, 'anonymous sees only public image records');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select extensions.is(
  (select count(*)::integer from public.community_profiles where id = auth.uid()),
  1,
  'an authenticated newcomer can read their own profile before posting or joining'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$select public.community_create_post('Dark', 'Blocked', 'public', null)$$,
  '42501', 'community write unavailable', 'direct RPC writes fail while dark'
);
select extensions.throws_ok(
  $$select public.community_set_membership('10000000-0000-0000-0000-000000000002', 'revoked', 'not allowed')$$,
  '42501', 'admin required', 'a non-admin cannot mutate membership'
);
reset role;

update public.community_launch_state set writes_enabled = true, private_reads_enabled = true where id;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$select public.community_create_post('Same title', 'A public draft', 'public', null)$$,
  'a verified contributor can create a public draft after launch'
);
select extensions.throws_ok(
  $$select public.community_create_post('Private attempt', 'Blocked', 'members', null)$$,
  '42501', 'community audience unavailable', 'a contributor cannot create a member draft'
);
select extensions.lives_ok(
  $$select public.community_create_reply('20000000-0000-0000-0000-000000000001', 'A reply')$$,
  'a contributor can reply to a public post'
);
select extensions.is(
  (select audience from public.community_replies where author_id = auth.uid() limit 1),
  'public', 'a reply inherits its parent audience'
);
select extensions.is(public.community_toggle_vote('20000000-0000-0000-0000-000000000001'), true, 'first toggle adds one vote');
select extensions.is(public.community_toggle_vote('20000000-0000-0000-0000-000000000001'), false, 'second toggle removes the vote');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select extensions.is((select count(*)::integer from public.community_posts where audience = 'members'), 1, 'an active member can read member content');
select extensions.lives_ok(
  $$select public.community_create_post('Same title', 'A member draft', 'members', null)$$,
  'an active member can create a member draft'
);
reset role;

select extensions.is(
  (select count(distinct slug)::integer from public.community_posts where title = 'Same title'),
  2, 'same-title public and member posts receive unrelated random-bearing slugs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$select public.community_set_membership('10000000-0000-0000-0000-000000000002', 'revoked', 'policy test')$$,
  'an admin can revoke membership atomically'
);
reset role;
select extensions.is(
  (select count(*)::integer from public.community_membership_audits where subject_id = '10000000-0000-0000-0000-000000000002'),
  1, 'membership transition creates one audit row'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select extensions.is((select count(*)::integer from public.community_posts where audience = 'members'), 0, 'revocation affects the existing session immediately');
reset role;

select * from extensions.finish();
rollback;
