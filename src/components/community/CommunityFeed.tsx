import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityPostView } from "@/lib/community";
import { communityExcerpt } from "@/lib/seo";

type FeedPost = CommunityPostView & { headerImageUrl?: string | null };
type Role = "anonymous" | "contributor" | "member" | "admin";
type FeedState = { posts: FeedPost[]; nextCursor: string | null; loaded: boolean };

type Props = {
  initialPosts: FeedPost[];
  initialNextCursor: string | null;
  initialAudience: "public" | "members";
  role: Role;
  initialError?: string;
};

function dateLabel(value: string | null) {
  if (!value) return "Draft";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function FeedCard({ post }: { post: FeedPost }) {
  const imageUrl = post.headerImageUrl || (post.audience === "members" && post.headerImageId
    ? `/api/community/media/${post.headerImageId}`
    : null);
  return (
    <article className="community-post-card">
      <div className="community-post-card__vote" aria-label={`${post.score} upvotes`}>
        <span aria-hidden="true">▲</span><strong>{post.score}</strong>
      </div>
      <div className="community-post-card__body">
        <div className="community-module-bar">
          <span>{post.audience === "members" ? "MEMBERS" : "PUBLIC"}</span>
          <span>{dateLabel(post.publishedAt)}</span>
        </div>
        {post.headerEnabled && imageUrl ? <img className="community-post-card__image" src={imageUrl} alt="" loading="lazy" /> : null}
        <div className="community-post-card__content">
          <p className="community-post-card__byline">Posted by <strong>{post.authorName}</strong></p>
          <h2><a href={`/community/${post.slug}`}>{post.title}</a></h2>
          <p>{communityExcerpt(post.bodyMarkdown, 220)}</p>
          <div className="community-post-card__meta">
            <a href={`/community/${post.slug}#replies`}>{post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</a>
            <span>{post.score} {post.score === 1 ? "upvote" : "upvotes"}</span>
            {post.githubRepositoryUrl ? <span>GitHub linked</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CommunityFeed({ initialPosts, initialNextCursor, initialAudience, role, initialError = "" }: Props) {
  const [audience, setAudience] = useState<"public" | "members">(initialAudience);
  const [feeds, setFeeds] = useState<Record<"public" | "members", FeedState>>({
    public: { posts: initialAudience === "public" ? initialPosts : [], nextCursor: initialAudience === "public" ? initialNextCursor : null, loaded: initialAudience === "public" },
    members: { posts: initialAudience === "members" ? initialPosts : [], nextCursor: initialAudience === "members" ? initialNextCursor : null, loaded: initialAudience === "members" },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const canReadMembers = role === "member" || role === "admin";
  const feedsRef = useRef(feeds);

  useEffect(() => {
    feedsRef.current = feeds;
  }, [feeds]);

  const load = useCallback(async (target: "public" | "members", append = false) => {
    if (target === "members" && !canReadMembers) return;
    const current = feedsRef.current[target];
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ audience: target });
      if (append && current.nextCursor) params.set("cursor", current.nextCursor);
      const response = await fetch(`/api/community/feed?${params}`, { credentials: "same-origin" });
      const result = await response.json() as { posts?: FeedPost[]; nextCursor?: string | null; error?: { message?: string } };
      if (!response.ok || !result.posts) throw new Error(result.error?.message || "The feed could not be loaded.");
      setFeeds((all) => {
        const next = {
          ...all,
          [target]: {
          posts: append ? [...all[target].posts, ...result.posts!] : result.posts!,
          nextCursor: result.nextCursor || null,
          loaded: true,
        },
        };
        feedsRef.current = next;
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The feed could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canReadMembers]);

  function choose(target: "public" | "members") {
    setAudience(target);
    setError("");
    const url = new URL(window.location.href);
    if (target === "members") url.searchParams.set("tab", "members");
    else url.searchParams.delete("tab");
    window.history.replaceState({}, "", url);
    if (!feeds[target].loaded && (target === "public" || canReadMembers)) void load(target);
  }

  useEffect(() => {
    const handler = (event: PopStateEvent) => {
      void event;
      const next = new URL(window.location.href).searchParams.get("tab") === "members" ? "members" : "public";
      setAudience(next);
      if (!feedsRef.current[next].loaded && (next === "public" || canReadMembers)) void load(next);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [canReadMembers, load]);

  const current = feeds[audience];
  const guidance = audience === "members" && !canReadMembers;

  return (
    <section className="community-feed" aria-labelledby="community-feed-title">
      <div className="community-feed__head">
        <div>
          <p className="community-script-label">Shared feed</p>
          <h2 id="community-feed-title">Latest from the Circuit</h2>
        </div>
        <div className="community-tabs" role="tablist" aria-label="Community feeds">
          <button role="tab" aria-selected={audience === "public"} onClick={() => choose("public")}>Public</button>
          <button role="tab" aria-selected={audience === "members"} onClick={() => choose("members")}>Members</button>
        </div>
      </div>

      <div className="community-feed__status" aria-live="polite">
        {loading ? "Loading posts…" : error ? error : ""}
      </div>

      {guidance ? (
        <div className="community-feed-state community-feed-state--members">
          <span aria-hidden="true">●</span>
          <h3>{role === "anonymous" ? "Sign in to check your access" : "Members access is invitation-only"}</h3>
          <p>{role === "anonymous" ? "Use your verified email. If you are a member, your private feed appears after sign-in." : "Nick and Lucy manage membership. Public posting and conversations are still open to verified contributors."}</p>
          {role === "anonymous" ? <a className="community-button community-button--primary" href="/auth?next=%2Fcommunity%3Ftab%3Dmembers">Sign in</a> : null}
        </div>
      ) : error && current.posts.length === 0 ? (
        <div className="community-feed-state">
          <h3>The feed did not load</h3><p>{error}</p>
          <button className="community-button" type="button" onClick={() => void load(audience)}>Try again</button>
        </div>
      ) : !loading && current.loaded && current.posts.length === 0 ? (
        <div className="community-feed-state">
          <h3>{audience === "public" ? "Be the first to post" : "The members feed is ready for its first note"}</h3>
          <p>Share a build, a useful question, or the lesson you wish you had yesterday.</p>
          <a className="community-button community-button--primary" href={`/community/submit?audience=${audience}`}>Share a post</a>
        </div>
      ) : (
        <div className="community-post-list" role="tabpanel" aria-label={`${audience} posts`}>
          {current.posts.map((post) => <FeedCard key={post.id} post={post} />)}
        </div>
      )}

      {current.nextCursor && !guidance ? (
        <button className="community-load-more" type="button" disabled={loading} onClick={() => void load(audience, true)}>
          {loading ? "Loading…" : "Load more posts"}
        </button>
      ) : current.loaded && current.posts.length > 0 ? <p className="community-end">You’re caught up.</p> : null}
    </section>
  );
}
