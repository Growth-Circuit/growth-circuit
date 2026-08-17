import { useState } from "react";

type Props = {
  postId: string;
  score: number;
  csrfToken: string;
  signedIn: boolean;
  initialVoted?: boolean;
};

export default function VoteButton({ postId, score, csrfToken, signedIn, initialVoted = false }: Props) {
  const [voted, setVoted] = useState(initialVoted);
  const [currentScore, setCurrentScore] = useState(score);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleVote() {
    if (!signedIn) {
      window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/community/posts/${postId}/vote`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
      const result = await response.json() as { voted?: boolean; error?: { message?: string } };
      if (!response.ok || typeof result.voted !== "boolean") {
        throw new Error(result.error?.message || "The vote could not be saved.");
      }
      setCurrentScore((value) => Math.max(0, value + (result.voted ? 1 : -1)));
      setVoted(result.voted);
      setMessage(result.voted ? "Upvoted." : "Vote removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The vote could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="community-vote">
      <button
        type="button"
        className="community-vote__button"
        aria-label={`${voted ? "Remove upvote from" : "Upvote"} this post`}
        aria-pressed={voted}
        disabled={busy}
        onClick={() => void toggleVote()}
      >
        <span aria-hidden="true">▲</span>
        <strong>{currentScore}</strong>
      </button>
      <span className="sr-only" aria-live="polite">{message}</span>
    </div>
  );
}
