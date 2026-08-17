import { LogIn, UserRound } from "lucide-react";
import { useState } from "react";

type Props = {
  csrfToken: string;
  name?: string;
  signedIn?: boolean;
};

export default function AuthBar({ csrfToken, name, signedIn = false }: Props) {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const response = await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ next: "/community" }),
    });
    const result = await response.json() as { next?: string };
    window.location.assign(result.next || "/community");
  }

  if (signedIn) {
    return (
      <button className="button" type="button" onClick={signOut} disabled={loading} title="Sign out">
        <UserRound size={18} aria-hidden="true" />
        {loading ? "Signing out" : name ? `Sign out ${name}` : "Sign out"}
      </button>
    );
  }

  return (
    <a className="button primary" href="/auth?next=%2Fcommunity" title="Sign in">
      <LogIn size={18} aria-hidden="true" />
      Sign in
    </a>
  );
}
