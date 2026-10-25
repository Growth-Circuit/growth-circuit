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
 * Only the fields Nick supplied are stored. No bio, and no company or role
 * when none was given. Photos are the cropped headshots he provided, served
 * from `public/community/members/` like the homepage cards.
 */
export type BlogAttendee = {
  id: string;
  name: string;
  initials: string;
  linkedin: string;
  photo: string;
  role?: string;
  company?: string;
};

export const blogAttendees: BlogAttendee[] = [
  {
    id: "andy-dabinett",
    name: "Andy Dabinett",
    initials: "AD",
    photo: "/community/members/andy-dabinett.jpg",
    role: "Technical PM",
    company: "Brand Networks",
    linkedin: "https://www.linkedin.com/in/andy-dabinett",
  },
  {
    id: "david-ronen",
    name: "David Ronen",
    initials: "DR",
    photo: "/community/members/david-ronen.jpg",
    role: "Agentic Growth Architect",
    linkedin: "https://www.linkedin.com/in/david-ronen",
  },
  {
    id: "rohit-khanna",
    name: "Rohit Khanna",
    initials: "RK",
    photo: "/community/members/rohit-khanna.jpg",
    role: "Founder",
    company: "BodhiMinds.ai",
    linkedin: "https://www.linkedin.com/in/rohitkkhanna",
  },
  {
    id: "will-leatherman",
    name: "Will Leatherman",
    initials: "WL",
    photo: "/community/members/will-leatherman.jpg",
    role: "Founder",
    company: "Catalyst Content",
    linkedin: "https://www.linkedin.com/in/willleatherman",
  },
  {
    id: "felicia-baskin",
    name: "Felicia Baskin",
    initials: "FB",
    photo: "/community/members/felicia-baskin.jpg",
    role: "Content and SEO leader",
    linkedin: "https://www.linkedin.com/in/feliciabaskin",
  },
  {
    id: "daphne-earp-hoppenot",
    name: "Daphne Earp Hoppenot",
    initials: "DH",
    photo: "/community/members/daphne-earp-hoppenot.jpg",
    role: "Founder",
    company: "Gravot GTM",
    linkedin: "https://www.linkedin.com/in/daphneearp",
  },
  {
    id: "hayley-brunetto",
    name: "Hayley Brunetto",
    initials: "HB",
    photo: "/community/members/hayley-brunetto.jpg",
    linkedin: "https://www.linkedin.com/in/hayley-brunetto/",
  },
];
