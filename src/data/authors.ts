/**
 * Reusable bylines for blog posts.
 *
 * Role lines match the homepage host captions in `GrowthCircuitHome.astro`
 * (the short line under each name): Nick is "Profound", Lucy is "Carta".
 * Photos and LinkedIn URLs are the ones that homepage already uses.
 * Lucy has no personal website in the repo, so `website` stays unset.
 */
export type Author = {
  id: string;
  name: string;
  role: string;
  photo: string;
  /** CSS object-position so the round crop matches the homepage portrait. */
  photoPosition?: string;
  website?: string;
  linkedin?: string;
};

export const authors: Author[] = [
  {
    id: "nick",
    name: "Nick Lafferty",
    role: "Profound",
    photo: "/hosts/nick-lafferty.jpg",
    photoPosition: "30% 25%",
    website: "https://nicklafferty.com",
    linkedin: "https://www.linkedin.com/in/nicklafferty/",
  },
  {
    id: "lucy",
    name: "Lucy Hoyle",
    role: "Carta",
    photo: "/hosts/lucy-hoyle-blurred.jpg",
    photoPosition: "50% 8%",
    linkedin: "https://www.linkedin.com/in/lucyjanehoyle",
  },
];

const authorsById = new Map(authors.map((author) => [author.id, author]));

export function authorById(id: string) {
  return authorsById.get(id) ?? null;
}

export function unknownAuthorIds(ids: string[]) {
  return ids.filter((id) => !authorsById.has(id));
}
