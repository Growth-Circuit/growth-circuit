import { useEffect, useId, useState } from "react";
import {
  CommunityMarkdownError,
  renderCommunityMarkdown,
} from "@/lib/community-markdown";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const prompts = [
  { label: "What I built", heading: "What I built", hint: "Describe the thing you made and who it helps." },
  { label: "How it works", heading: "How it works", hint: "Walk through the useful parts of your approach." },
  { label: "What broke", heading: "What broke", hint: "Share the surprising failure or rough edge." },
  { label: "What I learned", heading: "What I learned", hint: "Capture the lesson you would reuse next time." },
] as const;

export default function MarkdownEditor({ value, onChange, disabled = false }: MarkdownEditorProps) {
  const id = useId();
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    let active = true;
    renderCommunityMarkdown(value)
      .then((html) => {
        if (!active) return;
        setPreviewHtml(html);
        setPreviewError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPreviewHtml("");
        setPreviewError(
          error instanceof CommunityMarkdownError
            ? error.message
            : "The preview could not be generated.",
        );
      });
    return () => {
      active = false;
    };
  }, [value]);

  function insertPrompt(heading: string, hint: string) {
    const prefix = value.trimEnd();
    const insertion = `## ${heading}\n\n${hint}`;
    onChange(prefix ? `${prefix}\n\n${insertion}\n` : `${insertion}\n`);
  }

  return (
    <div className="community-markdown-editor">
      <div className="field">
        <div className="community-editor-label-row">
          <label htmlFor={id}>Post</label>
          <span>Markdown supported</span>
        </div>
        <textarea
          id={id}
          name="bodyMarkdown"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Share what you made, tried, or learned."
          required
          disabled={disabled}
          rows={12}
        />
      </div>

      <div className="community-prompt-list" aria-label="Optional writing prompts">
        {prompts.map((prompt) => (
          <button
            key={prompt.heading}
            type="button"
            className="pill"
            onClick={() => insertPrompt(prompt.heading, prompt.hint)}
            disabled={disabled}
          >
            + {prompt.label}
          </button>
        ))}
      </div>

      <section className="draft-preview community-markdown-preview" aria-live="polite">
        <div className="thread-topline">
          <span className="pill">Preview</span>
        </div>
        {previewError ? (
          <p className="status-message error" role="alert">{previewError}</p>
        ) : previewHtml ? (
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <p>Your preview will appear here.</p>
        )}
      </section>
    </div>
  );
}

