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
select extensions.has_table('public', 'community_upload_rate_limits');

select extensions.has_function('public', 'community_is_admin', array['uuid']);
select extensions.has_function('public', 'community_is_active_member', array['uuid']);
select extensions.has_function('public', 'community_random_slug', array['text']);
select extensions.has_function('public', 'community_create_post', array['text', 'text', 'text', 'text']);
select extensions.has_function('public', 'community_publish_post', array['uuid']);
select extensions.has_function('public', 'community_update_post', array['uuid', 'text', 'text', 'text']);
select extensions.has_function('public', 'community_delete_post', array['uuid']);
select extensions.has_function('public', 'community_create_reply', array['uuid', 'text']);
select extensions.has_function('public', 'community_toggle_vote', array['uuid']);
select extensions.has_function('public', 'community_set_membership', array['uuid', 'text', 'text', 'uuid']);
select extensions.has_function('public', 'community_moderate_content', array['text', 'uuid', 'text', 'text', 'uuid']);
select extensions.has_function('public', 'community_set_post_header', array['uuid', 'uuid', 'boolean']);
select extensions.has_function('public', 'community_begin_image', array['uuid', 'text', 'bigint']);
select extensions.has_function('public', 'community_consume_upload_quota', array['bigint']);
select extensions.has_function('public', 'community_finalize_image', array['uuid', 'text', 'bigint', 'integer', 'integer']);
select extensions.has_function('public', 'community_delete_image', array['uuid']);
select extensions.has_function('public', 'community_reorder_images', array['uuid', 'uuid[]']);
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
  not has_table_privilege('authenticated', 'public.community_admins', 'update')
  and not has_table_privilege('authenticated', 'public.community_admins', 'delete'),
  'product roles cannot change or remove admin status'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_membership_audits', 'insert'),
  'membership audits are function-owned'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_membership_audits', 'update')
  and not has_table_privilege('authenticated', 'public.community_membership_audits', 'delete'),
  'membership audits are immutable to product roles'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_moderation_audits', 'insert')
  and not has_table_privilege('authenticated', 'public.community_moderation_audits', 'update')
  and not has_table_privilege('authenticated', 'public.community_moderation_audits', 'delete'),
  'moderation audits are immutable to product roles'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.community_upload_rate_limits', 'select')
  and not has_table_privilege('authenticated', 'public.community_upload_rate_limits', 'insert')
  and not has_table_privilege('authenticated', 'public.community_upload_rate_limits', 'update'),
  'the upload quota ledger is private to atomic database functions'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.community_consume_upload_quota(bigint)', 'execute'),
  'authenticated callers cannot consume or manipulate quota outside begin image'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.community_publish_post(uuid)'::regprocedure),
  'publish uses a fixed empty search path'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.community_set_membership(uuid,text,text,uuid)'::regprocedure),
  'membership mutation uses a fixed empty search path'
);
select extensions.ok(
  (select proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.community_finalize_image(uuid,text,bigint,integer,integer)'::regprocedure),
  'image finalization uses a fixed empty search path'
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
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'newcomer@example.test', now(), '{}', '{}'),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'second-admin@example.test', now(), '{}', '{}');
insert into public.community_profiles (id, first_name, last_name) values
  ('10000000-0000-0000-0000-000000000001', 'Ada', 'Admin'),
  ('10000000-0000-0000-0000-000000000002', 'Mina', 'Member'),
  ('10000000-0000-0000-0000-000000000003', 'Connie', 'Contributor'),
  ('10000000-0000-0000-0000-000000000004', 'Nora', 'Newcomer'),
  ('10000000-0000-0000-0000-000000000005', 'Lucy', 'Admin');
insert into public.community_admins (user_id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005');
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
select extensions.throws_ok(
  $$select public.community_update_post('20000000-0000-0000-0000-000000000002', 'Changed', 'Changed', null)$$,
  '42501', 'post unavailable', 'a revoked member cannot edit an existing member post'
);
select extensions.throws_ok(
  $$select public.community_delete_post('20000000-0000-0000-0000-000000000002')$$,
  '42501', 'post unavailable', 'a revoked member cannot delete an existing member post'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select extensions.lives_ok(
  $$select public.community_set_membership('10000000-0000-0000-0000-000000000004', 'active', 'grant proof')$$,
  'the second admin can grant membership'
);
select extensions.lives_ok(
  $$select public.community_set_membership('10000000-0000-0000-0000-000000000004', 'suspended', 'suspend proof')$$,
  'the second admin can suspend membership'
);
select extensions.lives_ok(
  $$select public.community_set_membership('10000000-0000-0000-0000-000000000004', 'active', 'restore proof')$$,
  'the second admin can restore membership'
);
select extensions.lives_ok(
  $$select public.community_set_membership('10000000-0000-0000-0000-000000000004', 'revoked', 'revoke proof')$$,
  'the second admin can revoke membership'
);
select extensions.lives_ok(
  $$select public.community_moderate_content('post', '20000000-0000-0000-0000-000000000001', 'hidden', 'hide proof')$$,
  'the second admin can hide a post'
);
select extensions.lives_ok(
  $$select public.community_moderate_content('post', '20000000-0000-0000-0000-000000000001', 'visible', 'restore proof')$$,
  'the second admin can restore a post'
);
reset role;

select extensions.is(
  (select count(*)::integer from public.community_membership_audits
    where actor_id = '10000000-0000-0000-0000-000000000005'
      and subject_id = '10000000-0000-0000-0000-000000000004'),
  4,
  'each membership transition records one audit row for the actor and target'
);
select extensions.is(
  (select string_agg(coalesce(previous_status, 'none') || '>' || new_status, ',' order by id)
    from public.community_membership_audits
    where actor_id = '10000000-0000-0000-0000-000000000005'
      and subject_id = '10000000-0000-0000-0000-000000000004'),
  'none>active,active>suspended,suspended>active,active>revoked',
  'membership audits preserve every prior and new state'
);
select extensions.ok(
  (select bool_and(created_at is not null and char_length(reason) > 0)
    from public.community_membership_audits
    where actor_id = '10000000-0000-0000-0000-000000000005'),
  'membership audits retain timestamps and reasons'
);
select extensions.is(
  (select count(*)::integer from public.community_moderation_audits
    where actor_id = '10000000-0000-0000-0000-000000000005'
      and content_id = '20000000-0000-0000-0000-000000000001'),
  2,
  'hide and restore each record one moderation audit row'
);
select extensions.is(
  (select string_agg(previous_state || '>' || new_state, ',' order by id)
    from public.community_moderation_audits
    where actor_id = '10000000-0000-0000-0000-000000000005'
      and content_id = '20000000-0000-0000-0000-000000000001'),
  'visible>hidden,hidden>visible',
  'moderation audits preserve the actor, target, prior state, and new state'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  $$select public.community_update_post('20000000-0000-0000-0000-000000000001', 'Hijacked', 'Hijacked', null)$$,
  '42501', 'post unavailable', 'a non-author cannot edit another contributor post'
);
select extensions.throws_ok(
  $$select public.community_delete_post('20000000-0000-0000-0000-000000000001')$$,
  '42501', 'post unavailable', 'a non-author cannot delete another contributor post'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$select public.community_update_post('20000000-0000-0000-0000-000000000001', 'Updated by author', 'Updated body', 'https://github.com/growth-circuit/example/')$$,
  'an eligible author can edit intended post fields'
);
reset role;
select extensions.is(
  (select row(author_id, audience, publication_state, moderation_state, score, reply_count)::text
   from public.community_posts where id = '20000000-0000-0000-0000-000000000001'),
  '(10000000-0000-0000-0000-000000000003,public,published,visible,0,1)',
  'editing preserves author, audience, state, moderation, score, and reply count'
);
select extensions.is(
  (select github_repository_url from public.community_posts where id = '20000000-0000-0000-0000-000000000001'),
  'https://github.com/growth-circuit/example',
  'editing normalizes the intended repository field'
);

insert into public.community_posts (
  id, author_id, audience, publication_state, title, slug, body_markdown, moderation_state, published_at
) values
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'public', 'draft', 'Public image draft', 'public-image-a1b2c3d4e5f7', 'Draft', 'visible', null),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 'members', 'draft', 'Member image draft', 'member-image-a1b2c3d4e5f8', 'Draft', 'visible', null),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000003', 'public', 'published', 'Published image post', 'published-image-a1b2c3d4e5f9', 'Published', 'visible', now()),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000003', 'public', 'deleted', 'Deleted image post', 'deleted-image-a1b2c3d4e5fa', 'Deleted', 'visible', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select extensions.throws_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/jpeg', 1024)$$,
  '42501', 'post unavailable', 'another user cannot begin an image for an owned draft'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000012', 'image/jpeg', 1024)$$,
  '42501', 'post unavailable', 'a published post cannot accept a staging image'
);
select extensions.throws_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000013', 'image/jpeg', 1024)$$,
  '42501', 'post unavailable', 'a deleted post cannot accept a staging image'
);
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/jpeg', 1024)$$, 'first image begins');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/png', 1024)$$, 'second image begins');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/webp', 1024)$$, 'third image begins');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/jpeg', 1024)$$, 'fourth image begins');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/png', 1024)$$, 'fifth image begins');
select extensions.throws_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/jpeg', 1024)$$,
  'P0001', 'image limit exceeded', 'a draft cannot exceed five image records'
);
select extensions.is(
  (select count(*)::integer from public.community_images where post_id = '20000000-0000-0000-0000-000000000010'),
  5, 'the five-image cap is atomic'
);
select extensions.ok(
  (select bool_and(object_path ~ ('^10000000-0000-0000-0000-000000000003/20000000-0000-0000-0000-000000000010/'
    || '[0-9a-f-]{36}\.(jpg|png|webp)$')) from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000010'),
  'staging object paths are generated from trusted actor, post, image, and mime data'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select extensions.throws_ok(
  $$select public.community_finalize_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' order by position limit 1),
    'image/jpeg', 1024, 800, 600)$$,
  '42501', 'image unavailable', 'another user cannot finalize an owned staging image'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$select public.community_finalize_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' order by position limit 1),
    'image/jpeg', 5242881, 800, 600)$$,
  '22023', 'invalid image metadata', 'finalization rejects a file over five MiB'
);
select extensions.lives_ok(
  $$select public.community_finalize_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' order by position limit 1),
    'image/jpeg', 900, 800, 600)$$,
  'an owned public staging image finalizes after normalized output changes its byte length'
);
select extensions.lives_ok(
  $$select public.community_finalize_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' order by position limit 1),
    'image/jpeg', 900, 800, 600)$$,
  'an identical finalize replay is idempotent'
);
select extensions.is(
  (select byte_size from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000010' and state = 'ready'),
  900::bigint, 'the finalized row stores actual normalized output bytes'
);
select extensions.is(
  (select bucket_id from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000010' and state = 'ready'),
  'community-public', 'public images finalize only into the public bucket'
);
select extensions.lives_ok(
  $$select public.community_reorder_images(
    '20000000-0000-0000-0000-000000000010',
    (select array_agg(id order by position desc) from public.community_images
      where post_id = '20000000-0000-0000-0000-000000000010' and state <> 'deleted'))$$,
  'five images reorder atomically without position collisions'
);
select extensions.is(
  (select array_agg(position order by position)::text from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000010' and state <> 'deleted'),
  '{0,1,2,3,4}', 'reordering retains one contiguous position per image'
);
select extensions.lives_ok(
  $$select public.community_set_post_header(
    '20000000-0000-0000-0000-000000000010',
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' and state = 'ready'), true)$$,
  'the existing header RPC accepts a finalized owned image'
);
select extensions.is(
  (select position::integer from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000010' and state = 'ready'),
  4, 'the selected ready image occupies slot four after reordering'
);
select extensions.lives_ok(
  $$select public.community_delete_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' and state = 'ready'))$$,
  'an owned draft image is marked deleted'
);
select extensions.lives_ok(
  $$select public.community_delete_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' and state = 'deleted' order by position desc limit 1))$$,
  'an identical image deletion replay is idempotent'
);
select extensions.lives_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000010', 'image/jpeg', 1024)$$,
  'deleting slot four makes it reusable by a new staging image'
);
select extensions.is(
  (select position::integer from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000010' and state = 'staging'
    order by created_at desc limit 1),
  4, 'the new staging image safely reuses deleted slot four'
);
select extensions.is(
  (select header_image_id from public.community_posts where id = '20000000-0000-0000-0000-000000000010'),
  null::uuid, 'deleting the selected image clears the header pointer'
);
reset role;

update public.community_memberships set status = 'active'
where user_id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000011', 'image/webp', 2048)$$,
  'an active member can begin a member image'
);
select extensions.lives_ok(
  $$select public.community_finalize_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000011'),
    'image/webp', 2048, 640, 480)$$,
  'an active member can finalize a member image'
);
select extensions.is(
  (select row(audience, bucket_id)::text from public.community_images
    where post_id = '20000000-0000-0000-0000-000000000011'),
  '(members,community-private)', 'member image audience stays protected and derives the private bucket'
);
select extensions.throws_ok(
  $$select public.community_set_post_header(
    '20000000-0000-0000-0000-000000000011',
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000010' limit 1), true)$$,
  '42501', 'header image unavailable', 'an image cannot cross post or audience boundaries'
);
reset role;
update public.community_memberships set status = 'revoked'
where user_id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  $$select public.community_delete_image(
    (select id from public.community_images where post_id = '20000000-0000-0000-0000-000000000011'))$$,
  '42501', 'image unavailable', 'a revoked member cannot mutate an existing member image'
);
reset role;

insert into public.community_posts (
  id, author_id, audience, publication_state, title, slug, body_markdown, moderation_state, published_at
) values
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000003', 'public', 'draft', 'Quota draft one', 'quota-one-a1b2c3d4e5fb', 'Draft', 'visible', null),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000003', 'public', 'draft', 'Quota draft two', 'quota-two-a1b2c3d4e5fc', 'Draft', 'visible', null);
select extensions.ok(
  pg_get_functiondef('public.community_consume_upload_quota(bigint)'::regprocedure) like '%on conflict (user_id) do update%',
  'concurrent quota consumption serializes through one user ledger row'
);
select extensions.ok(
  pg_get_functiondef('public.community_begin_image(uuid,text,bigint)'::regprocedure) like '%community_consume_upload_quota%',
  'every successful begin operation consumes quota in the same transaction'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000014', 'image/jpeg', 5242880)$$, 'cross-post byte reservation one succeeds');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000014', 'image/jpeg', 5242880)$$, 'cross-post byte reservation two succeeds');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000014', 'image/jpeg', 5242880)$$, 'cross-post byte reservation three succeeds');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000014', 'image/jpeg', 5242880)$$, 'cross-post byte reservation four succeeds');
select extensions.throws_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000014', 'image/jpeg', 5242880)$$,
  'P0001', 'upload quota exceeded', 'declared bytes are bounded across posts in one hourly window'
);
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000015', 'image/jpeg', 1024)$$, 'cross-post sign attempt eleven succeeds');
select extensions.lives_ok($$select public.community_begin_image('20000000-0000-0000-0000-000000000015', 'image/jpeg', 1024)$$, 'cross-post sign attempt twelve succeeds');
select extensions.throws_ok(
  $$select public.community_begin_image('20000000-0000-0000-0000-000000000015', 'image/jpeg', 1024)$$,
  'P0001', 'upload quota exceeded', 'sign attempts are bounded atomically across posts'
);
reset role;
select extensions.is(
  (select sign_count from public.community_upload_rate_limits
    where user_id = '10000000-0000-0000-0000-000000000003'),
  12, 'failed concurrent-style reservations do not advance the committed attempt counter'
);
select extensions.is(
  (select declared_bytes from public.community_upload_rate_limits
    where user_id = '10000000-0000-0000-0000-000000000003'),
  20979712::bigint, 'the ledger records exact declared bytes from successful cross-post reservations'
);

select extensions.ok(
  exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = 'public.community_membership_audits'::regclass and i.indisunique and a.attname = 'request_id'),
  'membership request IDs are uniquely constrained for concurrent retries'
);
select extensions.ok(
  exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = 'public.community_moderation_audits'::regclass and i.indisunique and a.attname = 'request_id'),
  'moderation request IDs are uniquely constrained for concurrent retries'
);
select extensions.ok(
  pg_get_functiondef('public.community_set_membership(uuid,text,text,uuid)'::regprocedure) like '%pg_advisory_xact_lock%',
  'membership retries serialize on request ID before mutation'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select extensions.lives_ok(
  $$select public.community_set_membership(
    '10000000-0000-0000-0000-000000000004', 'active', 'idempotent proof', '90000000-0000-4000-8000-000000000001')$$,
  'the first membership request succeeds'
);
select extensions.lives_ok(
  $$select public.community_set_membership(
    '10000000-0000-0000-0000-000000000004', 'active', 'idempotent proof', '90000000-0000-4000-8000-000000000001')$$,
  'an identical membership retry succeeds without another transition'
);
select extensions.throws_ok(
  $$select public.community_set_membership(
    '10000000-0000-0000-0000-000000000004', 'suspended', 'idempotent proof', '90000000-0000-4000-8000-000000000001')$$,
  '22023', 'request id reuse mismatch', 'membership request ID reuse rejects a mismatched payload'
);
select extensions.lives_ok(
  $$select public.community_moderate_content(
    'post', '20000000-0000-0000-0000-000000000002', 'hidden', 'idempotent proof', '90000000-0000-4000-8000-000000000002')$$,
  'the first moderation request succeeds'
);
select extensions.lives_ok(
  $$select public.community_moderate_content(
    'post', '20000000-0000-0000-0000-000000000002', 'hidden', 'idempotent proof', '90000000-0000-4000-8000-000000000002')$$,
  'an identical moderation retry succeeds without another transition'
);
select extensions.throws_ok(
  $$select public.community_moderate_content(
    'post', '20000000-0000-0000-0000-000000000002', 'visible', 'idempotent proof', '90000000-0000-4000-8000-000000000002')$$,
  '22023', 'request id reuse mismatch', 'moderation request ID reuse rejects a mismatched payload'
);
reset role;
select extensions.is(
  (select count(*)::integer from public.community_membership_audits
    where request_id = '90000000-0000-4000-8000-000000000001'),
  1, 'membership retries create exactly one audit row'
);
select extensions.is(
  (select count(*)::integer from public.community_moderation_audits
    where request_id = '90000000-0000-4000-8000-000000000002'),
  1, 'moderation retries create exactly one audit row'
);
update public.community_posts set moderation_state = 'visible'
where id = '20000000-0000-0000-0000-000000000002';

update public.community_posts set moderation_state = 'hidden'
where id = '20000000-0000-0000-0000-000000000001';
set local role anon;
select extensions.is(
  (select count(*)::integer from public.community_posts where id = '20000000-0000-0000-0000-000000000001'),
  0, 'a hidden post is not publicly visible'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$select public.community_update_post('20000000-0000-0000-0000-000000000001', 'Hidden edit', 'Blocked', null)$$,
  '42501', 'post unavailable', 'an author cannot edit content while it is hidden by moderation'
);
reset role;

update public.community_posts set moderation_state = 'visible'
where id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$select public.community_delete_post('20000000-0000-0000-0000-000000000001')$$,
  'an eligible author can soft-delete their post'
);
select extensions.lives_ok(
  $$select public.community_delete_post('20000000-0000-0000-0000-000000000001')$$,
  'soft deletion is idempotent for the eligible author'
);
reset role;
select extensions.is(
  (select row(author_id, audience, moderation_state, score, reply_count, deleted_at is not null)::text
   from public.community_posts where id = '20000000-0000-0000-0000-000000000001'),
  '(10000000-0000-0000-0000-000000000003,public,visible,0,1,t)',
  'soft deletion preserves protected fields and records deletion time'
);
set local role anon;
select extensions.is(
  (select count(*)::integer from public.community_posts where id = '20000000-0000-0000-0000-000000000001'),
  0, 'a deleted post is not publicly visible'
);
reset role;

select * from extensions.finish();
rollback;
