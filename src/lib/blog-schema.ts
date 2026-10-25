import { z } from "astro/zod";
import { unknownAuthorIds } from "../data/authors";
import { unknownCommunityMemberIds } from "../data/community-members";
import { unknownToolSlugs } from "../data/tools";

/** Calendar dates stay `YYYY-MM-DD` even when YAML parses them as Date objects. */
const calendarDate = z.preprocess((value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date."));

export const blogPostSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    publishDate: calendarDate,
    updatedDate: calendarDate,
    /** Author ids from `src/data/authors.ts`, in byline order. */
    authors: z.array(z.string().trim().min(1)).min(1),
    featured: z.boolean(),
    category: z.string().trim().min(1).optional(),
    heroImage: z.string().trim().min(1).optional(),
    heroImageAlt: z.string().trim().min(1).optional(),
    /**
     * Set `false` to skip FAQPage JSON-LD. Otherwise an H2 titled "FAQ"
     * is detected automatically.
     */
    faq: z.boolean().optional(),
    /** Tool slugs from `src/data/tools.ts`, rendered as an icon row near the top. */
    tools: z.array(z.string().trim().min(1)).optional(),
    /** Attendee ids from `src/data/community-members.ts`, rendered near the top. */
    members: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    for (const id of unknownAuthorIds(data.authors)) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown author id "${id}". Add them to src/data/authors.ts.`,
        path: ["authors"],
      });
    }
    (data.tools ?? []).forEach((slug, index) => {
      if (unknownToolSlugs([slug]).length) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown tool slug "${slug}". Add it to src/data/tools.ts.`,
          path: ["tools", index],
        });
      }
    });
    (data.members ?? []).forEach((id, index) => {
      if (unknownCommunityMemberIds([id]).length) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown member id "${id}". Add them to src/data/featured-community.ts or src/content/members.`,
          path: ["members", index],
        });
      }
    });
    if (data.heroImage && !data.heroImageAlt) {
      ctx.addIssue({
        code: "custom",
        message: "heroImageAlt is required when heroImage is set.",
        path: ["heroImageAlt"],
      });
    }
    if (data.updatedDate < data.publishDate) {
      ctx.addIssue({
        code: "custom",
        message: "updatedDate cannot be before publishDate.",
        path: ["updatedDate"],
      });
    }
  });

export type BlogPostData = z.infer<typeof blogPostSchema>;
