import { ArrowBigUp } from "lucide-react";
import { useState } from "react";

type Props = {
  score: number;
  label: string;
};

export default function VoteButton({ score, label }: Props) {
  const [value, setValue] = useState(score);
  const [voted, setVoted] = useState(false);

  function toggleVote() {
    setValue((current) => current + (voted ? -1 : 1));
    setVoted((current) => !current);
  }

  return (
    <button
      className="icon-button"
      type="button"
      onClick={toggleVote}
      title={voted ? `Remove upvote from ${label}` : `Upvote ${label}`}
      aria-pressed={voted}
      aria-label={voted ? `Remove upvote from ${label}` : `Upvote ${label}`}
      style={voted ? { background: "var(--matcha)" } : undefined}
    >
      <ArrowBigUp size={20} aria-hidden="true" />
      <span className="score" style={{ position: "absolute", left: "-9999px" }}>
        {value}
      </span>
    </button>
  );
}
