import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  APPLICATION_TEXT_LIMITS,
  normalizeApplication,
  validateApplication,
  type ApplicationPayload,
  type ApplicationResult,
} from "@/lib/application";

type FormState = ApplicationPayload;

const blankForm: FormState = {
  full_name: "",
  email: "",
  linkedin_url: "",
  current_title: "",
  current_company: "",
  location: "",
  specialty: "",
  proud_build: "",
  build_interest: "Not collected in the announcement form.",
  referral_source: "",
  video_url: "",
  speciality_dish: "Not collected in the announcement form.",
  consent_to_promotional_clips: false,
  auth_provider: "manual",
  profile_source: "self_reported",
  user_id: null,
};

export default function ApplicationForm() {
  const [form, setForm] = useState<FormState>(blankForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ApplicationPayload, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function updateField(field: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setMessage("");
  }

  async function submitApplication(event: { preventDefault: () => void }) {
    event.preventDefault();
    setMessage("");

    const payload = normalizeApplication(form);
    const localFieldErrors = validateApplication(payload);

    if (Object.keys(localFieldErrors).length > 0) {
      setForm(payload);
      setStatus("error");
      setFieldErrors(localFieldErrors);
      setMessage("Please fix the highlighted fields before submitting.");
      return;
    }

    setForm(payload);
    setStatus("submitting");

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApplicationResult;

      if (!result.ok) {
        setStatus("error");
        setMessage(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      setStatus("success");
      setFieldErrors({});
      setMessage(
        result.mode === "preview"
          ? "Application preview captured. Add Supabase env vars to store submissions."
          : "Application submitted. Lucy and Nick will review it soon.",
      );
    } catch {
      setStatus("error");
      setMessage("Something interrupted the submission. Please try again.");
    }
  }

  return (
    <section className="composer application-card" id="apply" aria-labelledby="apply-title">
      <div className="application-card-head">
        <div>
          <p className="eyebrow">Application</p>
          <h2 id="apply-title">Apply to join the NYC community</h2>
        </div>
        <span className="pill">Invite-only</span>
      </div>

      <div className="form-note">
        We will use this only to review and follow up on your Growth Circuit application.
      </div>

      {!isSupabaseConfigured && (
        <div className="form-note">
          Preview mode: submissions validate locally and call the API, but are not persisted until Supabase env vars are set.
        </div>
      )}

      <form onSubmit={submitApplication}>
        <div className="form-grid">
          <Field label="Name" error={fieldErrors.full_name}>
            <input
              name="full_name"
              value={form.full_name}
              onChange={(event) => updateField("full_name", event.target.value)}
              placeholder="Your name"
              aria-invalid={Boolean(fieldErrors.full_name)}
            />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
            />
          </Field>
        </div>

        <Field label="LinkedIn profile" error={fieldErrors.linkedin_url}>
          <input
            name="linkedin_url"
            value={form.linkedin_url}
            onChange={(event) => updateField("linkedin_url", event.target.value)}
            placeholder="https://www.linkedin.com/in/..."
            aria-invalid={Boolean(fieldErrors.linkedin_url)}
          />
        </Field>

        <div className="form-grid">
          <Field label="Company" error={fieldErrors.current_company}>
            <input
              name="current_company"
              value={form.current_company}
              onChange={(event) => updateField("current_company", event.target.value)}
              placeholder="Company or independent"
              aria-invalid={Boolean(fieldErrors.current_company)}
            />
          </Field>
          <Field label="Title" error={fieldErrors.current_title}>
            <input
              name="current_title"
              value={form.current_title}
              onChange={(event) => updateField("current_title", event.target.value)}
              placeholder="Growth, lifecycle, analytics, engineering..."
              aria-invalid={Boolean(fieldErrors.current_title)}
            />
          </Field>
        </div>

        <Field label="Location" error={fieldErrors.location}>
          <input
            name="location"
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="New York, NY"
            aria-invalid={Boolean(fieldErrors.location)}
          />
        </Field>

        <Field label="Something you've built" error={fieldErrors.proud_build}>
          <textarea
            name="proud_build"
            value={form.proud_build}
            maxLength={APPLICATION_TEXT_LIMITS.proud_build.max}
            onChange={(event) => updateField("proud_build", event.target.value)}
            placeholder="Concrete beats polished. What did you make, and what changed because of it?"
            aria-describedby="proud-build-count"
            aria-invalid={Boolean(fieldErrors.proud_build)}
          />
          <CharacterCount
            id="proud-build-count"
            count={form.proud_build.length}
            min={APPLICATION_TEXT_LIMITS.proud_build.min}
            max={APPLICATION_TEXT_LIMITS.proud_build.max}
          />
        </Field>

        <Field label="How did you hear about us?">
          <select
            name="referral_source"
            value={form.referral_source}
            onChange={(event) => updateField("referral_source", event.target.value)}
          >
            <option value="">Choose one</option>
            <option value="lucy-linkedin">Lucy Hoyle's LinkedIn</option>
            <option value="nick-linkedin">Nick Lafferty's LinkedIn</option>
            <option value="friend">A friend recommended me</option>
            <option value="linkedin">LinkedIn</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <button className="button matcha" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? <Loader2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          Submit application
        </button>

        {message && (
          <div className={`status-message ${status}`} role="status">
            {status === "success" && <CheckCircle2 size={18} aria-hidden="true" />}
            {message}
          </div>
        )}
      </form>
    </section>
  );
}

function CharacterCount({ id, count, min, max }: { id: string; count: number; min: number; max: number }) {
  const remainingMinimum = Math.max(min - count, 0);
  const isComplete = remainingMinimum === 0;

  return (
    <div className={`character-count ${isComplete ? "complete" : ""}`} id={id}>
      <span>
        {count.toLocaleString()} / {max.toLocaleString()} characters
      </span>
      <span>{isComplete ? "Minimum met" : `${remainingMinimum} more to meet the minimum`}</span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {error && <span className="field-error">{error}</span>}
      </label>
      {children}
    </div>
  );
}
