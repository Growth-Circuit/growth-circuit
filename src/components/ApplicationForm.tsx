import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  APPLICATION_TEXT_LIMITS,
  normalizeApplication,
  validateApplication,
  type ApplicationPayload,
  type ApplicationResult,
} from "@/lib/application";

type FormState = ApplicationPayload;
type ApplicationPath = "nyc" | "global";

const blankForm: FormState = {
  full_name: "",
  email: "",
  linkedin_url: "",
  current_title: "Inferred from LinkedIn profile.",
  current_company: "Inferred from LinkedIn profile.",
  location: "New York City",
  specialty: "",
  proud_build: "",
  build_interest: "Not collected in the announcement form.",
  referral_source: "",
  video_url: "",
  speciality_dish: "Not collected in the announcement form.",
  consent_to_promotional_clips: false,
  communication_preferences: [],
  auth_provider: "manual",
  profile_source: "self_reported",
  user_id: null,
};

export default function ApplicationForm() {
  const [path, setPath] = useState<ApplicationPath | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [waitlist, setWaitlist] = useState<{
    full_name: string;
    email: string;
    linkedin_url: string;
  }>({ full_name: "", email: "", linkedin_url: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ApplicationPayload, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const applicationSubmissionId = useRef<string | null>(null);
  const waitlistSubmissionId = useRef<string | null>(null);

  useEffect(() => {
    const requestedPath = new URLSearchParams(window.location.search).get("path");

    if (requestedPath === "nyc" || requestedPath === "global") {
      setPath(requestedPath);
    }
  }, []);

  function choosePath(nextPath: ApplicationPath) {
    setPath(nextPath);
    setStatus("idle");
    setMessage("");
    setFieldErrors({});
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
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
      applicationSubmissionId.current ||= crypto.randomUUID();
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": applicationSubmissionId.current,
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

      applicationSubmissionId.current = null;
      setStatus("success");
      setFieldErrors({});
      setMessage("Submission received! We'll be in touch soon");
    } catch {
      setStatus("error");
      setMessage("Something interrupted the submission. Please try again.");
    }
  }

  async function submitWaitlist(event: { preventDefault: () => void }) {
    event.preventDefault();
    setMessage("");

    const linkedinUrl = waitlist.linkedin_url.trim();
    const hasValidLinkedIn = linkedinUrl.startsWith("https://www.linkedin.com/")
      || linkedinUrl.startsWith("https://linkedin.com/");

    if (!waitlist.full_name.trim() || !waitlist.email.includes("@") || !hasValidLinkedIn) {
      setStatus("error");
      setMessage("Add your name, a valid email, and your LinkedIn profile to join the waitlist.");
      return;
    }

    setStatus("submitting");

    try {
      waitlistSubmissionId.current ||= crypto.randomUUID();
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": waitlistSubmissionId.current,
        },
        body: JSON.stringify(waitlist),
      });
      const result = (await response.json()) as { ok: boolean; error?: string; mode?: string };

      if (!result.ok) {
        setStatus("error");
        setMessage(result.error || "We could not add you to the waitlist. Please try again.");
        return;
      }

      waitlistSubmissionId.current = null;
      setStatus("success");
      setMessage("You’re on the list. We’ll be in touch when we launch a global cohort.");
    } catch {
      setStatus("error");
      setMessage("Something interrupted the submission. Please try again.");
    }
  }

  return (
    <section className="composer application-card" id="apply" aria-labelledby="apply-title">
      <div className="application-card-head">
        <div>
          <p className="eyebrow">Your path</p>
          <h2 id="apply-title">
            {path === "nyc" ? "Apply for New York" : path === "global" ? "Join the global waitlist" : "Do you live in New York City?"}
          </h2>
        </div>
        {path === "nyc" && <span className="pill">8 spaces</span>}
      </div>

      {path === null && (
        <div className="path-choice" aria-label="Choose your application path">
          <button className="path-card" type="button" onClick={() => choosePath("nyc")}>
            <span>Yes</span>
            <strong>New York, in person</strong>
            <small>Apply for the first cohort, starting September 2026.</small>
          </button>
          <button className="path-card path-card--global" type="button" onClick={() => choosePath("global")}>
            <span>No</span>
            <strong>Somewhere else</strong>
            <small>Join the global waitlist with your name, email, and LinkedIn profile.</small>
          </button>
        </div>
      )}

      {path === "global" && (
        <>
          <p className="form-intro">
            Leave your name, email, and LinkedIn profile. We’ll reach out when a cohort opens in your area.
            No noise until then.
          </p>
          <form onSubmit={submitWaitlist}>
            <Field label="Name">
              <input
                name="full_name"
                value={waitlist.full_name}
                onChange={(event) => setWaitlist((current) => ({ ...current, full_name: event.target.value }))}
                placeholder="Your name"
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                value={waitlist.email}
                onChange={(event) => setWaitlist((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="LinkedIn profile">
              <input
                name="linkedin_url"
                type="url"
                required
                value={waitlist.linkedin_url}
                onChange={(event) => setWaitlist((current) => ({ ...current, linkedin_url: event.target.value }))}
                placeholder="https://www.linkedin.com/in/..."
              />
            </Field>
            <button className="button matcha" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? <Loader2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
              Join the global waitlist
            </button>
          </form>
        </>
      )}

      {path === "nyc" && (
        <>
          <p className="form-intro">
            Your LinkedIn covers the basics. Show off the build you’re most proud of. Upload a video demo,
            a live link, or a GitHub repo.
          </p>

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

            <Field label="Show off the build you’re most proud of" error={fieldErrors.proud_build}>
              <textarea
                name="proud_build"
                value={form.proud_build}
                maxLength={APPLICATION_TEXT_LIMITS.proud_build.max}
                onChange={(event) => updateField("proud_build", event.target.value)}
                placeholder="Upload a video demo, a live link, or a GitHub repo."
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

            <Field label="How did you hear about us?" error={fieldErrors.referral_source}>
              <input
                name="referral_source"
                value={form.referral_source}
                required
                minLength={APPLICATION_TEXT_LIMITS.referral_source.min}
                maxLength={APPLICATION_TEXT_LIMITS.referral_source.max}
                onChange={(event) => updateField("referral_source", event.target.value)}
                placeholder="Tell us where you found Growth Circuit"
                aria-invalid={Boolean(fieldErrors.referral_source)}
              />
            </Field>

            <button className="button matcha" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? <Loader2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
              Submit application
            </button>
          </form>
        </>
      )}

      {path !== null && status !== "success" && (
        <button className="path-back" type="button" onClick={() => choosePath(path === "nyc" ? "global" : "nyc")}>
          <ArrowLeft size={15} aria-hidden="true" />
          {path === "nyc" ? "I’m outside New York" : "I live in New York"}
        </button>
      )}

      {message && (
        <div className={`status-message ${status}`} role="status">
          {status === "success" && <CheckCircle2 size={18} aria-hidden="true" />}
          {message}
        </div>
      )}
    </section>
  );
}

function CharacterCount({ id, count, min, max }: { id: string; count: number; min: number; max: number }) {
  const remainingMinimum = Math.max(min - count, 0);
  const isComplete = remainingMinimum === 0;

  return (
    <div className={`character-count ${isComplete ? "complete" : ""}`} id={id}>
      <span>{count.toLocaleString()} / {max.toLocaleString()} characters</span>
      <span>{isComplete ? "Ready to share" : `${remainingMinimum} more to get started`}</span>
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
