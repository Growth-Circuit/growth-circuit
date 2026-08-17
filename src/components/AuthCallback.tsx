import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";

type Props = { code: string; tokenHash: string; type: string; csrfToken: string; nextPath: string };

export default function AuthCallback({ code, tokenHash, type, csrfToken, nextPath }: Props) {
  const hasConfirmation = Boolean(code || (tokenHash && type));
  const [state, setState] = useState<"ready" | "loading" | "error" | "resending" | "resent">(hasConfirmation ? "ready" : "error");
  const [message, setMessage] = useState(hasConfirmation ? "Confirm to finish signing in." : "This confirmation link is incomplete. Request a new one.");
  const [email, setEmail] = useState("");

  async function confirm() {
    setState("loading");
    try {
      const response = await fetch("/api/auth/callback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ code, tokenHash, type, next: nextPath }),
      });
      const result = await response.json() as { error?: string; needsProfile?: boolean; next?: string };
      if (!response.ok) {
        setState("error");
        setMessage(result.error || "This link could not be confirmed. Request a new one.");
        return;
      }
      const target = result.needsProfile
        ? `/auth?complete=1&next=${encodeURIComponent(result.next || nextPath)}`
        : result.next || nextPath;
      window.location.replace(target);
    } catch {
      setState("error");
      setMessage("We could not reach the sign-in service. Please try again.");
    }
  }

  async function resend(event: { preventDefault: () => void }) {
    event.preventDefault();
    setState("resending");
    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ mode: "signin", email, next: nextPath }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        setState("error");
        setMessage(result.error || "We could not send a new link. Try again.");
        return;
      }
      setState("resent");
      setMessage(result.message || "A new confirmation link is on its way.");
    } catch {
      setState("error");
      setMessage("We could not send a new link. Try again.");
    }
  }

  return (
    <section className="composer auth-card" aria-labelledby="confirm-title">
      <p className="eyebrow">Email confirmation</p>
      <h1 id="confirm-title">Finish signing in.</h1>
      <p className="lead" role="status">{message}</p>

      {(state === "ready" || state === "loading") && (
        <button className="button matcha" type="button" onClick={confirm} disabled={state === "loading"}>
          {state === "loading" ? <Loader2 size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
          Confirm sign-in
        </button>
      )}

      {(state === "error" || state === "resending" || state === "resent") && (
        <form onSubmit={resend}>
          <div className="field">
            <label htmlFor="recovery-email">Email</label>
            <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} />
          </div>
          <button className="button" type="submit" disabled={state === "resending"}>
            {state === "resending" ? <Loader2 size={17} aria-hidden="true" /> : <Mail size={17} aria-hidden="true" />}
            Send a new link
          </button>
        </form>
      )}
    </section>
  );
}
