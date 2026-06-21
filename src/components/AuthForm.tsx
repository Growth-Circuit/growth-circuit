import { CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return new URLSearchParams(window.location.search).get("next") || "/";
  }, []);

  async function submitAuth(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoading(true);
    setStatus("idle");
    setMessage("");

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setLoading(false);
      setStatus("error");
      setMessage("Add Supabase URL and publishable key to .env to enable email/password auth.");
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setLoading(false);

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setStatus("success");
        setMessage("Account created. Check your email to confirm before signing in.");
        return;
      }

      window.location.href = nextPath;
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    window.location.href = nextPath;
  }

  return (
    <section className="composer auth-card" aria-labelledby="auth-title">
      <div className="application-card-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1 id="auth-title">{mode === "signin" ? "Sign in to Growth Circuit." : "Create your Growth Circuit account."}</h1>
        </div>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Auth mode">
        <button
          type="button"
          aria-selected={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setMessage("");
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-selected={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setMessage("");
          }}
        >
          Create account
        </button>
      </div>

      {!isSupabaseConfigured && (
        <div className="form-note">
          Supabase is not configured locally yet. Add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env`.
        </div>
      )}

      <form onSubmit={submitAuth}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="full-name">Name</label>
            <input
              id="full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
          />
        </div>

        <button className="button matcha" type="submit" disabled={loading}>
          {loading ? (
            <Loader2 size={17} aria-hidden="true" />
          ) : mode === "signup" ? (
            <UserPlus size={17} aria-hidden="true" />
          ) : (
            <LogIn size={17} aria-hidden="true" />
          )}
          {mode === "signup" ? "Create account" : "Sign in"}
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
