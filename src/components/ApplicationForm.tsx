import { CheckCircle2, Loader2, LogIn, Send, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { ApplicationPayload, ApplicationResult } from "@/lib/application";

type SessionProfile = {
  userId: string | null;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
};

type FormState = ApplicationPayload;

const blankForm: FormState = {
  full_name: "",
  email: "",
  linkedin_url: "",
  current_title: "",
  current_company: "",
  location: "New York, NY",
  specialty: "",
  proud_build: "",
  build_interest: "",
  referral_source: "",
  video_url: "",
  speciality_dish: "",
  consent_to_promotional_clips: true,
  auth_provider: "manual",
  profile_source: "self_reported",
  user_id: null,
};

export default function ApplicationForm() {
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ApplicationPayload, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;

      if (!user) return;

      const metadata = user.user_metadata;
      const provider = user.app_metadata?.provider || "unknown";
      const sessionProfile = {
        userId: user.id,
        email: user.email || "",
        name: metadata?.full_name || metadata?.name || user.email || "",
        avatar: metadata?.avatar_url || metadata?.picture,
        provider,
      };

      setProfile(sessionProfile);
      setForm((current) => ({
        ...current,
        user_id: sessionProfile.userId,
        full_name: current.full_name || sessionProfile.name,
        email: current.email || sessionProfile.email,
        auth_provider: provider,
      }));
    });
  }, []);

  const identityLabel = useMemo(() => {
    if (!profile) return "Not connected";
    if (profile.provider.includes("email")) return "Email/password account";
    return "Connected profile";
  }, [profile]);

  function updateField(field: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submitApplication(event: { preventDefault: () => void }) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const response = await fetch("/api/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
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
  }

  return (
    <section className="composer application-card" id="apply" aria-labelledby="apply-title">
      <div className="application-card-head">
        <div>
          <p className="eyebrow">Application</p>
          <h2 id="apply-title">Apply to join Growth Circuit</h2>
        </div>
        <span className="pill">12 seats</span>
      </div>

      <div className="identity-panel">
        <div className="identity-main">
          {profile?.avatar ? (
            <img src={profile.avatar} alt="" width={44} height={44} />
          ) : (
            <span className="identity-icon">
              <UserRound size={22} aria-hidden="true" />
            </span>
          )}
          <div>
            <strong>{profile?.name || identityLabel}</strong>
            <span>{profile?.email || "Create an account or sign in before submitting when Supabase is configured."}</span>
          </div>
        </div>
        {!profile && (
          <a className="button primary" href="/auth?next=%2Fnyc%23apply">
            <LogIn size={17} aria-hidden="true" />
            Sign in
          </a>
        )}
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
            />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
        </div>

        <Field label="LinkedIn profile" error={fieldErrors.linkedin_url}>
          <input
            name="linkedin_url"
            value={form.linkedin_url}
            onChange={(event) => updateField("linkedin_url", event.target.value)}
            placeholder="https://www.linkedin.com/in/..."
          />
        </Field>

        <div className="form-grid">
          <Field label="Current title" error={fieldErrors.current_title}>
            <input
              name="current_title"
              value={form.current_title}
              onChange={(event) => updateField("current_title", event.target.value)}
              placeholder="Growth, lifecycle, analytics, engineering..."
            />
          </Field>
          <Field label="Current company" error={fieldErrors.current_company}>
            <input
              name="current_company"
              value={form.current_company}
              onChange={(event) => updateField("current_company", event.target.value)}
              placeholder="Company or independent"
            />
          </Field>
        </div>

        <div className="form-grid">
          <Field label="Location" error={fieldErrors.location}>
            <input
              name="location"
              value={form.location}
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="New York, NY"
            />
          </Field>
          <Field label="Specialty">
            <input
              name="specialty"
              value={form.specialty}
              onChange={(event) => updateField("specialty", event.target.value)}
              placeholder="AI search, paid media, agents, analytics..."
            />
          </Field>
        </div>

        <Field label="What is one thing you built or shipped?" error={fieldErrors.proud_build}>
          <textarea
            name="proud_build"
            value={form.proud_build}
            onChange={(event) => updateField("proud_build", event.target.value)}
            placeholder="Concrete beats polished. What did you make, and what changed because of it?"
          />
        </Field>

        <Field label="What theme, tool, or problem would you bring?" error={fieldErrors.build_interest}>
          <textarea
            name="build_interest"
            value={form.build_interest}
            onChange={(event) => updateField("build_interest", event.target.value)}
            placeholder="Something you have explored, or something you want to explore with the room."
          />
        </Field>

        <div className="form-grid">
          <Field label="Video URL">
            <input
              name="video_url"
              value={form.video_url}
              onChange={(event) => updateField("video_url", event.target.value)}
              placeholder="Loom, YouTube, Drive..."
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
              <option value="forum">Growth Circuit forum</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        <Field label="Speciality dish" error={fieldErrors.speciality_dish}>
          <input
            name="speciality_dish"
            value={form.speciality_dish}
            onChange={(event) => updateField("speciality_dish", event.target.value)}
            placeholder="The most important field"
          />
        </Field>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.consent_to_promotional_clips}
            onChange={(event) => updateField("consent_to_promotional_clips", event.target.checked)}
          />
          <span>Growth Circuit can use application video clips in promo. Names and off-record details still require permission.</span>
        </label>

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
