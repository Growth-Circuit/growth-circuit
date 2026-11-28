import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { sortPostsNewestFirst } from "@/lib/blog";
import { listPublishedJobsIssues } from "@/lib/jobs-issues";
import { renderLlmsTxt, type LlmsEntry } from "@/lib/llms-txt";
import { listPublishedNewsletterIssues } from "@/lib/newsletter-issues";

export const prerender = true;

export const GET: APIRoute = async () => {
  const [posts, newsletters, jobs] = await Promise.all([
    getCollection("blog"),
    listPublishedNewsletterIssues(),
    listPublishedJobsIssues(),
  ]);

  const blogEntries: LlmsEntry[] = sortPostsNewestFirst(
    posts.map((post) => ({
      id: post.id,
      title: post.data.title,
      description: post.data.description,
      publishDate: post.data.publishDate,
      updatedDate: post.data.updatedDate,
      authors: post.data.authors,
      featured: post.data.featured,
    })),
  ).map((post) => ({
    title: post.title,
    description: post.description,
    path: `/blog/${post.id}`,
  }));

  const newsletterEntries: LlmsEntry[] = newsletters.map((issue) => ({
    title: issue.title,
    description: issue.description,
    path: issue.path,
  }));

  const jobEntries: LlmsEntry[] = jobs.map((issue) => ({
    title: issue.title,
    description: issue.description,
    path: issue.path,
  }));

  return new Response(renderLlmsTxt({ posts: blogEntries, newsletters: newsletterEntries, jobs: jobEntries }), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
