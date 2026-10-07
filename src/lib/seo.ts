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

export function blogCollectionJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Blog",
    description,
    url: canonical("/blog"),
    isPartOf: {
      "@type": "WebSite",
      name: "Growth Circuit",
      url: siteUrl,
    },
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  description: string;
  publishDate: string;
  updatedDate: string;
  path: string;
  image: string;
  authors: Array<{
    name: string;
    role: string;
    photo: string;
    website?: string;
    linkedin?: string;
  }>;
}) {
  const pageUrl = canonical(post.path);
  const image = post.image.startsWith("http") ? post.image : canonical(post.image);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishDate,
    dateModified: post.updatedDate,
    author: post.authors.map((person) => {
      const sameAs = [person.website, person.linkedin].filter((value): value is string => Boolean(value));
      return {
        "@type": "Person",
        name: person.name,
        jobTitle: person.role,
        image: person.photo.startsWith("http") ? person.photo : canonical(person.photo),
        ...(person.website ? { url: person.website } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      };
    }),
    image,
    mainEntityOfPage: pageUrl,
    publisher: {
      "@type": "Organization",
      name: "Growth Circuit",
      url: siteUrl,
    },
  };
}

export function faqPageJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function newsletterIssueJsonLd(issue: {
  title: string;
  description: string;
  publishedAt: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: issue.title,
    description: issue.description,
    datePublished: issue.publishedAt,
    url: canonical(`/newsletter/${issue.slug}`),
    author: [
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
    publisher: {
      "@type": "Organization",
      name: "Growth Circuit",
      url: siteUrl,
    },
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
