import { blogAttendees } from "./blog-attendees";
import { featuredMembers } from "./featured-community";

/**
 * Attendees named in blog posts, rendered via `PostMembers.astro` the same
 * way `src/data/authors.ts` backs the post byline.
 *
 * Valid ids come from three places:
 * - `featured-community.ts` (homepage cards; slug of the person's name)
 * - `src/content/members` (a real `/people/<github>` profile)
 * - `blog-attendees.ts` (post-only names with a LinkedIn URL and no GitHub)
 *
 * Blog attendees are not merged into the homepage list or the member
 * collection. An id that already belongs to a featured member or a profile
 * is left as-is, so this file never overwrites a photo, company, or link.
 */
export type CommunityMemberRef = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  detail?: string;
  photo?: string;
  initials?: string;
  linkedin?: string;
  /** Set when a matching `src/content/members` profile exists. */
  github?: string;
};

type MemberProfileFile = {
  name: string;
  github: string;
  linkedin?: string;
  photo?: string;
};

const profileFiles = import.meta.glob("../content/members/*.json", {
  eager: true,
  import: "default",
}) as Record<string, MemberProfileFile>;

const profiles = Object.values(profileFiles);

export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function profileForName(name: string, github?: string) {
  if (github) return profiles.find((profile) => profile.github === github);
  const slug = slugifyName(name);
  return profiles.find((profile) => slugifyName(profile.name) === slug);
}

const registry = new Map<string, CommunityMemberRef>();

for (const member of featuredMembers) {
  const id = slugifyName(member.name);
  const github = "github" in member ? member.github : undefined;
  const profile = profileForName(member.name, github);
  registry.set(id, {
    id,
    name: member.name,
    company: member.company,
    detail: member.detail,
    photo: member.photo,
    initials: member.initials,
    linkedin: member.linkedin,
    github: profile?.github,
  });
}

for (const profile of profiles) {
  const id = slugifyName(profile.name);
  if (registry.has(id)) continue;
  registry.set(id, { id, name: profile.name, photo: profile.photo, linkedin: profile.linkedin, github: profile.github });
}

for (const attendee of blogAttendees) {
  if (registry.has(attendee.id)) {
    throw new Error(`Blog attendee id "${attendee.id}" is already a featured member or a member profile.`);
  }
  registry.set(attendee.id, {
    id: attendee.id,
    name: attendee.name,
    company: attendee.company,
    role: attendee.role,
    initials: attendee.initials,
    photo: attendee.photo,
    linkedin: attendee.linkedin,
  });
}

export const communityMembers = [...registry.values()];

export function communityMemberById(id: string) {
  return registry.get(id) ?? null;
}

export function unknownCommunityMemberIds(ids: string[]) {
  return ids.filter((id) => !registry.has(id));
}

/** `/people/<github>` when a profile exists, otherwise LinkedIn. May be undefined if neither exists. */
export function communityMemberHref(member: Pick<CommunityMemberRef, "github" | "linkedin">) {
  return member.github ? `/people/${member.github}` : member.linkedin;
}
