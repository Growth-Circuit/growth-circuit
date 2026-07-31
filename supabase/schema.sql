-- Growth Circuit forum starter schema.
-- Run in Supabase SQL editor after creating the project and enabling email/password auth.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  full_name text not null,
  avatar_url text,
  role text,
  company text,
  city text,
  bio text,
  is_supper_club_member boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('question', 'build', 'discussion')),
  status text not null default 'open' check (status in ('open', 'answered', 'featured', 'hidden', 'locked')),
  title text not null,
  slug text unique not null,
  body text not null,
  score integer not null default 0,
  reply_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.posts(id) on delete cascade,
  body text not null,
  is_answer boolean not null default false,
  is_accepted boolean not null default false,
  score integer not null default 0,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  description text
);

create table public.thread_tags (
  thread_id uuid references public.threads(id) on delete cascade,
  tag_id bigint references public.tags(id) on delete cascade,
  primary key (thread_id, tag_id)
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  direction smallint not null check (direction in (-1, 1)),
  created_at timestamptz not null default now(),
  constraint vote_target check (
    (thread_id is not null and post_id is null) or
    (thread_id is null and post_id is not null)
  ),
  unique (user_id, thread_id),
  unique (user_id, post_id)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  prompt text not null,
  theme_setter_id uuid references public.profiles(id) on delete set null,
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.build_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, thread_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  linkedin_url text not null,
  auth_provider text not null default 'manual',
  profile_source text not null default 'self_reported',
  current_title text not null,
  current_company text not null,
  location text not null,
  specialty text,
  proud_build text not null,
  build_interest text not null,
  referral_source text,
  video_url text,
  speciality_dish text not null,
  consent_to_promotional_clips boolean not null default true,
  status text not null default 'new' check (status in ('new', 'accepted', 'declined', 'waitlist')),
  created_at timestamptz not null default now()
);

create table public.global_waitlist (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  thread_id uuid references public.threads(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint report_target check (
    (thread_id is not null and post_id is null) or
    (thread_id is null and post_id is not null)
  )
);

alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.tags enable row level security;
alter table public.thread_tags enable row level security;
alter table public.votes enable row level security;
alter table public.challenges enable row level security;
alter table public.build_submissions enable row level security;
alter table public.applications enable row level security;
alter table public.global_waitlist enable row level security;
alter table public.reports enable row level security;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Published threads are public" on public.threads
  for select using (status in ('open', 'answered', 'featured', 'locked'));
create policy "Authenticated users create threads" on public.threads
  for insert with check (auth.uid() = author_id);
create policy "Authors update own threads" on public.threads
  for update using (auth.uid() = author_id);

create policy "Published posts are public" on public.posts
  for select using (status = 'published');
create policy "Authenticated users create posts" on public.posts
  for insert with check (auth.uid() = author_id);
create policy "Authors update own posts" on public.posts
  for update using (auth.uid() = author_id);

create policy "Tags are public" on public.tags for select using (true);
create policy "Thread tags are public" on public.thread_tags for select using (true);

create policy "Votes visible to authenticated users" on public.votes
  for select using (auth.role() = 'authenticated');
create policy "Users create own votes" on public.votes
  for insert with check (auth.uid() = user_id);
create policy "Users update own votes" on public.votes
  for update using (auth.uid() = user_id);
create policy "Users delete own votes" on public.votes
  for delete using (auth.uid() = user_id);

create policy "Open challenges are public" on public.challenges
  for select using (status in ('open', 'closed'));
create policy "Build submissions are public" on public.build_submissions
  for select using (true);

create policy "Anyone can apply" on public.applications
  for insert with check (true);
create policy "Anyone can join global waitlist" on public.global_waitlist
  for insert with check (true);

create policy "Authenticated users create reports" on public.reports
  for insert with check (auth.role() = 'authenticated');
