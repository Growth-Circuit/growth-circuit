/**
 * People named on a blog post who are not in `featured-community.ts` and
 * do not have a `src/content/members` profile.
 *
 * A profile in `src/content/members` requires a GitHub username (`github`
 * is the filename, the `/people/<github>` route, and the avatar fallback)
 * plus a bio. None of these people supplied a GitHub handle, so they are
 * not profiles: inventing one would publish a `/people` page, a sitemap
 * URL, and a GitHub avatar for an account they may not have. Posts link
 * them straight to the LinkedIn URL below.
 *
 * Only the fields Nick supplied are stored. No photo, no bio, no company
 * or role when none was given.
 */
export type BlogAttendee = {
  id: string;
  name: string;
  initials: string;
  linkedin: string;
  role?: string;
  company?: string;
};

export const blogAttendees: BlogAttendee[] = [
  {
    id: "andy-dabinett",
    name: "Andy Dabinett",
    initials: "AD",
    role: "Technical PM",
    company: "Brand Networks",
    linkedin: "https://www.linkedin.com/in/andy-dabinett",
  },
  {
    id: "david-ronen",
    name: "David Ronen",
    initials: "DR",
    role: "Agentic Growth Architect",
    linkedin: "https://www.linkedin.com/in/david-ronen",
  },
  {
    id: "rohit-khanna",
    name: "Rohit Khanna",
    initials: "RK",
    role: "Founder",
    company: "BodhiMinds.ai",
    linkedin: "https://www.linkedin.com/in/rohitkkhanna",
  },
  {
    id: "will-leatherman",
    name: "Will Leatherman",
    initials: "WL",
    role: "Founder",
    company: "Catalyst Content",
    linkedin: "https://www.linkedin.com/in/willleatherman",
  },
  {
    id: "felicia-baskin",
    name: "Felicia Baskin",
    initials: "FB",
    role: "Content and SEO leader",
    linkedin: "https://www.linkedin.com/in/feliciabaskin",
  },
  {
    id: "daphne-earp-hoppenot",
    name: "Daphne Earp Hoppenot",
    initials: "DH",
    role: "Founder",
    company: "Gravot GTM",
    linkedin: "https://www.linkedin.com/in/daphneearp",
  },
  {
    id: "hayley-brunetto",
    name: "Hayley Brunetto",
    initials: "HB",
    linkedin: "https://www.linkedin.com/in/hayley-brunetto/",
  },
];
