begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_table('public', 'community_projects', 'public profile projects exist');
select extensions.has_table('public', 'community_profile_moderation_audits', 'profile moderation audit exists');
select extensions.has_function('public', 'community_save_public_profile', array['text','text','text','text','text','text','text','text','jsonb']);
select extensions.has_function('public', 'community_complete_profile', array['text','text']);
select extensions.has_function('public', 'community_moderate_profile', array['uuid','text','text','uuid']);
select extensions.ok(not has_table_privilege('authenticated', 'public.community_profile_moderation_audits', 'insert'), 'profile audits are function owned');

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'profile-admin@example.test', now(), '{}', '{}'),
  ('91000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'builder@example.test', now(), '{}', '{}'),
  ('91000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'draft@example.test', now(), '{}', '{}');
insert into public.community_profiles (id, first_name, last_name) values
  ('91000000-0000-0000-0000-000000000001', 'Ada', 'Admin'),
  ('91000000-0000-0000-0000-000000000002', 'Grace', 'Builder'),
  ('91000000-0000-0000-0000-000000000003', 'Draft', 'Builder');
insert into public.community_admins (user_id) values ('91000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$select public.community_save_public_profile('Grace','Builder','grace-builds','Growth systems builder','I ship useful systems.','Brooklyn, NY','https://example.test','published','[{"title":"Doorway build","description":"A published project.","url":"https://example.test/build","kind":"doorway"}]'::jsonb)$$,
  'a verified user can publish a profile while the forum remains parked'
);
select extensions.is((select count(*)::integer from public.community_projects where owner_id = auth.uid()), 1, 'project shelf is saved atomically');
select extensions.throws_ok(
  $$select public.community_save_public_profile('Grace','Builder','bad handle','','','','','published','[]'::jsonb)$$,
  '22023', 'invalid public profile', 'direct callers cannot bypass publish validation'
);
reset role;

set local role anon;
select extensions.is((select count(*)::integer from public.community_profiles where handle = 'grace-builds'), 1, 'anonymous visitors can read published visible profiles');
select extensions.is((select count(*)::integer from public.community_profiles where id = '91000000-0000-0000-0000-000000000003'), 0, 'anonymous visitors cannot read drafts');
select extensions.is((select count(*)::integer from public.community_projects where owner_id = '91000000-0000-0000-0000-000000000002'), 1, 'anonymous visitors can read projects for published visible profiles');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$select public.community_moderate_profile('91000000-0000-0000-0000-000000000002','hidden','policy test','92000000-0000-0000-0000-000000000001')$$,
  'an admin can hide a profile'
);
reset role;

set local role anon;
select extensions.is((select count(*)::integer from public.community_profiles where handle = 'grace-builds'), 0, 'hidden profiles fail closed for anonymous visitors');
select extensions.is((select count(*)::integer from public.community_projects where owner_id = '91000000-0000-0000-0000-000000000002'), 0, 'projects disappear when their profile is hidden');
reset role;

select extensions.is((select count(*)::integer from public.community_profile_moderation_audits where profile_id = '91000000-0000-0000-0000-000000000002'), 1, 'moderation creates one immutable audit record');
select * from extensions.finish();
rollback;
