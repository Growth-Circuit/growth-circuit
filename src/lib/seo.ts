import type { Thread } from "@/data/forum";
import type { CommunityPostView, CommunityReplyView } from "@/lib/community";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.club";

export function canonical(pathname: string) {
  return new URL(pathname, siteUrl).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Growth Circuit",
    url: siteUrl,
    description: "An NYC-first community for people building growth systems, with public events and a global WhatsApp group.",
    foundingDate: "2026",
    slogan: "Meet the people building growth systems",
    founder: [
      {
        "@type": "Person",
        name: "Nick Lafferty",
        sameAs: "https://www.linkedin.com/in/nicklafferty/",
      },
      {
        "@type": "Person",
        name: "Lucy Hoyle",
        sameAs: "https://www.linkedin.com/in/lucyjanehoyle",
      },
    ],
  };
}

export function threadJsonLd(thread: Thread) {
  const url = canonical(
    thread.type === "question" ? `/questions/${thread.slug}` : `/builds/${thread.slug}`,
  );

  if (thread.type === "question") {
    return {
      "@context": "https://schema.org",
      "@type": "QAPage",
      mainEntity: {
        "@type": "Question",
        name: thread.title,
        text: thread.body,
        answerCount: thread.replies,
        upvoteCount: thread.score,
        datePublished: thread.createdAt,
        dateModified: thread.updatedAt,
        url,
        author: {
          "@type": "Person",
          name: thread.author,
        },
        acceptedAnswer: thread.replyList
          .filter((reply) => reply.accepted)
          .map((reply) => ({
            "@type": "Answer",
            text: reply.body,
            upvoteCount: reply.score,
            author: {
              "@type": "Person",
              name: reply.author,
            },
          }))[0],
        suggestedAnswer: thread.replyList
          .filter((reply) => !reply.accepted)
          .map((reply) => ({
            "@type": "Answer",
            text: reply.body,
            upvoteCount: reply.score,
            author: {
              "@type": "Person",
              name: reply.author,
            },
          })),
      },
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: thread.title,
    text: thread.body,
    datePublished: thread.createdAt,
    dateModified: thread.updatedAt,
    url,
    author: {
      "@type": "Person",
      name: thread.author,
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: thread.score,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: thread.replies,
      },
    ],
    comment: thread.replyList.map((reply) => ({
      "@type": "Comment",
      text: reply.body,
      upvoteCount: reply.score,
      author: {
        "@type": "Person",
        name: reply.author,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonical(item.path),
    })),
  };
}

export function communityPostJsonLd(post: CommunityPostView, replies: CommunityReplyView[] = []) {
  if (post.audience !== "public" || post.state !== "published" || post.moderationState !== "visible") return null;
  const url = canonical(`/community/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    text: post.bodyMarkdown,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url,
    author: { "@type": "Person", name: post.authorName },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.score,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.replyCount,
      },
    ],
    comment: replies.map((reply) => ({
      "@type": "Comment",
      text: reply.bodyMarkdown,
      dateCreated: reply.createdAt,
      author: { "@type": "Person", name: reply.authorName },
    })),
  };
}

export function communityExcerpt(markdown: string, maxLength = 180) {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~|\[\]()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 1).trimEnd()}…` : plain;
}
