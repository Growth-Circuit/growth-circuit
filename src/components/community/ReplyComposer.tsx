import { useState } from "react";

type Props = {
  postId: string;
  csrfToken: string;
  signedIn: boolean;
  nextPath: string;
};

export default function ReplyComposer({ postId, csrfToken, signedIn, nextPath }: Props) {
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");

  if (!signedIn) {
    return (
      <div className="community-reply-gate">
        <p>Sign in with your verified email to join this conversation.</p>
        <a className="community-button community-button--primary" href={`/auth?next=${encodeURIComponent(nextPath)}`}>Sign in to reply</a>
      </div>
    );
  }

  async function submitReply(event: { preventDefault: () => void }) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setStatus("idle");
    try {
      const response = await fetch(`/api/community/posts/${postId}/replies`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ bodyMarkdown }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "The reply could not be posted.");
      setStatus("success");
      setMessage("Reply posted.");
      setBodyMarkdown("");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The reply could not be posted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="community-reply-composer" onSubmit={submitReply}>
      <label htmlFor="community-reply-body">Add to the conversation</label>
      <textarea
        id="community-reply-body"
        value={bodyMarkdown}
        onChange={(event) => setBodyMarkdown(event.target.value)}
        placeholder="Share a useful detail, question, or lesson…"
        maxLength={10_000}
        required
        disabled={busy}
      />
      <div className="community-reply-composer__footer">
        <p>Markdown is supported. Uploaded images only.</p>
        <button className="community-button community-button--primary" type="submit" disabled={busy || !bodyMarkdown.trim()}>
          {busy ? "Posting…" : "Post reply"}
        </button>
      </div>
      <p className={`community-form-status community-form-status--${status}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
