import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { renderBlogRss, type BlogListItem } from "@/lib/blog";

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const posts: BlogListItem[] = (await getCollection("blog")).map((post) => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    publishDate: post.data.publishDate,
    updatedDate: post.data.updatedDate,
    authors: post.data.authors,
    featured: post.data.featured,
    category: post.data.category,
  }));

  return renderBlogRss(posts, site ?? "https://growthcircuit.club");
};
