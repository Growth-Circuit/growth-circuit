import type { Thread } from "@/data/forum";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.club";

export function canonical(pathname: string) {
  return new URL(pathname, siteUrl).toString();
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Growth Circuit",
    url: siteUrl,
    description:
      "An intimate, invite-only community for Marketing Engineers based in New York City or nearby.",
    foundingDate: "2026",
    slogan: "Bring Your Own Build",
    founder: [
      {
        "@type": "Person",
        name: "Nick Lafferty",
        sameAs: "https://www.linkedin.com/in/nicklafferty/",
      },
      {
        "@type": "Person",
        name: "Lucy Hoyle",
        sameAs: "https://www.linkedin.com/in/lucy-hoyle-883381138",
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
