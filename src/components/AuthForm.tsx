import { CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";

type Mode = "signin" | "signup" | "profile";

type Props = {
  csrfToken: string;
  nextPath: string;
  initialMode?: Mode;
  signupEnabled?: boolean;
};

export default function AuthForm({ csrfToken, nextPath, initialMode = "signin", signupEnabled = false }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submitAuth(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoading(true);
    setStatus("idle");
    setMessage("");

    const endpoint = mode === "profile" ? "/api/auth/profile" : "/api/auth/request-link";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ mode, email, firstName, lastName, next: nextPath }),
      });
      const result = await response.json() as { error?: string; message?: string; next?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(result.error || "We could not complete that request. Please try again.");
        return;
      }

      if (mode === "profile") {
        window.location.assign(result.next || nextPath);
        return;
      }

      setStatus("success");
      setMessage(result.message || "Check your email for a confirmation link.");
    } catch {
      setStatus("error");
      setMessage("We could not reach the sign-in service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signin"
    ? "Sign in to Growth Circuit."
    : mode === "signup"
      ? "Create your Growth Circuit account."
      : "Finish your profile.";

  return (
    <section className="composer auth-card" aria-labelledby="auth-title">
      <div className="application-card-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1 id="auth-title">{title}</h1>
        </div>
      </div>

      {mode !== "profile" && signupEnabled && (
        <div className="segmented-control" role="tablist" aria-label="Auth mode">
          <button type="button" aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setMessage(""); }}>
            Sign in
          </button>
          <button type="button" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setMessage(""); }}>
            Create account
          </button>
        </div>
      )}

      <form onSubmit={submitAuth}>
        {(mode === "signup" || mode === "profile") && (
          <div className="application-grid two-col">
            <div className="field">
              <label htmlFor="first-name">First name</label>
              <input id="first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="last-name">Last name</label>
              <input id="last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required maxLength={80} />
            </div>
          </div>
        )}
        {mode !== "profile" && (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required maxLength={254} />
          </div>
        )}

        <button className="button matcha" type="submit" disabled={loading}>
          {loading ? <Loader2 size={17} aria-hidden="true" /> : mode === "signup" ? <UserPlus size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
          {mode === "profile" ? "Save and continue" : mode === "signup" ? "Email me a confirmation link" : "Email me a sign-in link"}
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
