import { Send } from "lucide-react";
import { useState } from "react";

type ThreadType = "question" | "build" | "discussion";

type ThreadComposerProps = {
  variant?: "panel" | "page";
};

type ThreadDraft = {
  type: ThreadType;
  title: string;
  body: string;
};

const typeLabels: Record<ThreadType, string> = {
  question: "Question",
  build: "Build",
  discussion: "Discussion",
};

export default function ThreadComposer({ variant = "panel" }: ThreadComposerProps) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<ThreadDraft>({
    type: "question",
    title: "",
    body: "",
  });

  const isPage = variant === "page";
  const titleId = isPage ? "submit-title" : "composer-title";
  const draftTitle = form.title.trim() || "Untitled draft";
  const draftBody =
    form.body.trim() ||
    "Add the setup, what you tried, what broke, and where you want sharper thinking.";

  function updateField<Field extends keyof ThreadDraft>(field: Field, value: ThreadDraft[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSubmitted(false);
  }

  return (
    <section
      className={`composer thread-composer ${isPage ? "submit-composer" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="composer-head">
        {isPage ? <p className="eyebrow">New post</p> : null}
        {isPage ? (
          <h1 id={titleId}>Post to Growth Circuit</h1>
        ) : (
          <h2 id={titleId}>Ask the Circuit</h2>
        )}
        <p>
          Draft the question, build note, or discussion starter. Live publishing will connect to
          Supabase once the forum tables and auth flow are ready.
        </p>
      </div>

      <div className="composer-flow">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="field">
            <label htmlFor="thread-type">Type</label>
            <select
              id="thread-type"
              name="type"
              value={form.type}
              onChange={(event) => updateField("type", event.target.value as ThreadType)}
            >
              <option value="question">Question</option>
              <option value="build">Build</option>
              <option value="discussion">Discussion</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="thread-title">Title</label>
            <input
              id="thread-title"
              name="title"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="What are you trying to figure out?"
            />
          </div>
          <div className="field">
            <label htmlFor="thread-body">Context</label>
            <textarea
              id="thread-body"
              name="body"
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              placeholder="Share the setup, what you tried, what broke, and where you want sharper thinking."
            />
          </div>
          <button className="button matcha" type="submit">
            <Send size={17} aria-hidden="true" />
            Preview draft
          </button>
          <div className={`success-note ${submitted ? "visible" : ""}`} role="status">
            Draft preview updated. Posting to Supabase is the next wire-up.
          </div>
        </form>

        <div className="draft-preview" aria-live="polite">
          <div className="thread-topline">
            <span className="tag">{typeLabels[form.type]}</span>
            <span className="pill">Draft preview</span>
          </div>
          <h2>{draftTitle}</h2>
          <p>{draftBody}</p>
        </div>
      </div>
    </section>
  );
}
