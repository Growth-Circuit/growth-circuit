import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { assertBlogSlug, blogSlugFromFilename } from "./lib/blog";
import { blogPostSchema } from "./lib/blog-schema";
import { memberProfileSchema, memberIdFromFilename } from "./lib/member-schema";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: ["**/*.md", "!README.md", "!**/README.md", "!_*.md", "!**/_*.md"],
    generateId: ({ entry }) => assertBlogSlug(blogSlugFromFilename(entry)),
  }),
  schema: blogPostSchema,
});

const members = defineCollection({
  loader: glob({
    base: "./src/content/members",
    pattern: "*.json",
    generateId: ({ entry, data }) => memberIdFromFilename(entry, data),
  }),
  schema: memberProfileSchema,
});

export const collections = { blog, members };
