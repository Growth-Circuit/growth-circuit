import { Send } from "lucide-react";
import { useState } from "react";

export default function ThreadComposer() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="composer" aria-labelledby="composer-title">
      <h2 id="composer-title">Ask the Circuit</h2>
      <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>
        The live version will post through Supabase after Google SSO. For now, this previews the
        lightweight writing flow.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <div className="field">
          <label htmlFor="thread-type">Type</label>
          <select id="thread-type" name="type">
            <option>Question</option>
            <option>Build</option>
            <option>Discussion</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="thread-title">Title</label>
          <input id="thread-title" name="title" placeholder="What are you trying to figure out?" />
        </div>
        <div className="field">
          <label htmlFor="thread-body">Context</label>
          <textarea
            id="thread-body"
            name="body"
            placeholder="Share the setup, what you tried, what broke, and where you want sharper thinking."
          />
        </div>
        <button className="button matcha" type="submit">
          <Send size={17} aria-hidden="true" />
          Post preview
        </button>
        <div className={`success-note ${submitted ? "visible" : ""}`} role="status">
          Draft captured locally. Supabase posting is the next wire-up.
        </div>
      </form>
    </section>
  );
}
