import { Loader2, Send } from "lucide-react";
import { useCallback, useState } from "react";
import type { CommunityAudience, CommunityPost } from "@/types/community";
import { normalizeCommunityGitHubUrl } from "@/lib/community-github";
import { renderCommunityMarkdown } from "@/lib/community-markdown";
import GitHubRepoField from "./GitHubRepoField";
import ImageUploader from "./ImageUploader";
import MarkdownEditor from "./MarkdownEditor";

export type CommunityPostDraft = {
  title: string;
  bodyMarkdown: string;
  audience: CommunityAudience;
  githubRepositoryUrl: string | null;
};

type PostComposerProps = {
  csrfToken: string;
  canPublishToMembers?: boolean;
  initialAudience?: CommunityAudience;
  submitPost?: (draft: CommunityPostDraft) => Promise<CommunityPost>;
  onPublished?: (post: CommunityPost) => void;
};

type ApiResult = {
  ok?: boolean;
  post?: CommunityPost;
  error?: { message?: string } | string;
};

async function responseResult(response: Response): Promise<ApiResult> {
  const result = await response.json() as ApiResult;
  if (!response.ok || !result.ok || !result.post) {
    const message = typeof result.error === "string" ? result.error : result.error?.message;
    throw new Error(message || "We could not publish your post. Please try again.");
  }
  return result;
}

/** Keeps the composer's API dependency to draft creation followed by idempotent publication. */
export async function publishCommunityPost(
  draft: CommunityPostDraft,
  csrfToken: string,
  request: typeof fetch = fetch,
): Promise<CommunityPost> {
  const created = await createCommunityDraft(draft, csrfToken, request);
  return publishExistingDraft(created.id, csrfToken, request);
}

export async function createCommunityDraft(
  draft: CommunityPostDraft,
  csrfToken: string,
  request: typeof fetch = fetch,
) {
  return (await responseResult(await request("/api/community/posts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(draft),
  }))).post!;
}

export async function publishExistingDraft(postId: string, csrfToken: string, request: typeof fetch = fetch) {
  return (await responseResult(await request(`/api/community/posts/${postId}/publish`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
  }))).post!;
}

export default function PostComposer({
  csrfToken,
  canPublishToMembers = false,
  initialAudience = "public",
  submitPost,
  onPublished,
}: PostComposerProps) {
  const [title, setTitle] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [audience, setAudience] = useState<CommunityAudience>(
    initialAudience === "members" && !canPublishToMembers ? "public" : initialAudience,
  );
  const [githubUrl, setGithubUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [draftPost, setDraftPost] = useState<CommunityPost | null>(null);
  const [imagesBusy, setImagesBusy] = useState(false);
  const handleImagesBusy = useCallback((busy: boolean) => setImagesBusy(busy), []);

  function finishPublishing(post: CommunityPost) {
    if (onPublished) {
      onPublished(post);
      return;
    }
    window.location.assign(`/community/${post.slug}`);
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setMessage("");
    setStatus("idle");

    const normalizedRepository = githubUrl.trim()
      ? normalizeCommunityGitHubUrl(githubUrl)
      : null;
    if (githubUrl.trim() && !normalizedRepository) {
      setStatus("error");
      setMessage("Enter a canonical GitHub repository URL or leave the field empty.");
      return;
    }

    try {
      setSubmitting(true);
      await renderCommunityMarkdown(bodyMarkdown);
      const draft = { title: title.trim(), bodyMarkdown, audience, githubRepositoryUrl: normalizedRepository };
      if (submitPost) {
        const post = await submitPost(draft);
        setStatus("success");
        setMessage("Your post is live.");
        finishPublishing(post);
      } else {
        const post = await createCommunityDraft(draft, csrfToken);
        setDraftPost(post);
        setStatus("success");
        setMessage("Draft saved. Add images if you want, then publish.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not publish your post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    if (!draftPost) return;
    setSubmitting(true);
    setMessage("");
    try {
      const post = await publishExistingDraft(draftPost.id, csrfToken);
      setStatus("success");
      setMessage("Your post is live.");
      finishPublishing(post);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not publish your post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="composer community-post-composer" aria-labelledby="community-composer-title">
      <div className="composer-head">
        <p className="eyebrow">New post</p>
        <h1 id="community-composer-title">Share with the Circuit</h1>
        <p>Start with the useful part. Add any prompts that help you tell the story.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="community-post-title">Title</label>
          <input
            id="community-post-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What did you make or learn?"
            required
            maxLength={180}
            disabled={submitting || Boolean(draftPost)}
          />
        </div>

        {canPublishToMembers ? (
          <div className="field">
            <label htmlFor="community-post-audience">Audience</label>
            <select
              id="community-post-audience"
              name="audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as CommunityAudience)}
              disabled={submitting || Boolean(draftPost)}
            >
              <option value="public">Public</option>
              <option value="members">Members</option>
            </select>
          </div>
        ) : null}

        <MarkdownEditor value={bodyMarkdown} onChange={setBodyMarkdown} disabled={submitting || Boolean(draftPost)} />
        <GitHubRepoField value={githubUrl} onChange={setGithubUrl} disabled={submitting || Boolean(draftPost)} />

        {!draftPost ? <button className="button matcha" type="submit" disabled={submitting}>
          {submitting ? <Loader2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          {submitting ? "Saving…" : "Continue to images"}
        </button> : null}
        {message ? <div className={`status-message ${status}`} role="status">{message}</div> : null}
      </form>

      {draftPost ? (
        <div className="community-post-composer__publish-step">
          <ImageUploader postId={draftPost.id} csrfToken={csrfToken} onBusyChange={handleImagesBusy} />
          <button className="button matcha" type="button" disabled={submitting || imagesBusy} onClick={() => void handlePublish()}>
            {submitting ? <Loader2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            {submitting ? "Publishing…" : imagesBusy ? "Finish image upload first" : "Publish post"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
