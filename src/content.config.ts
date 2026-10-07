import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { assertBlogSlug, blogSlugFromFilename } from "./lib/blog";
import { blogPostSchema } from "./lib/blog-schema";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: ["**/*.md", "!README.md", "!**/README.md", "!_*.md", "!**/_*.md"],
    generateId: ({ entry }) => assertBlogSlug(blogSlugFromFilename(entry)),
  }),
  schema: blogPostSchema,
});

export const collections = { blog };
