import { BriefcaseBusiness, LogIn, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type UserState = {
  name: string;
  avatar?: string;
};

export default function AuthBar() {
  const [user, setUser] = useState<UserState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setReady(true);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      const profile = data.user?.user_metadata;
      if (data.user) {
        setUser({
          name: profile?.full_name || data.user.email || "Member",
          avatar: profile?.avatar_url,
        });
      }
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const profile = session?.user?.user_metadata;
      setUser(
        session?.user
          ? {
              name: profile?.full_name || session.user.email || "Member",
              avatar: profile?.avatar_url,
            }
          : null,
      );
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(provider: "linkedin_oidc" | "google") {
    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      window.alert("Add Supabase env vars to enable LinkedIn and Google SSO.");
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase?.auth.signOut();
    setUser(null);
  }

  if (!ready) {
    return (
      <button className="button" type="button" disabled>
        Loading
      </button>
    );
  }

  if (user) {
    return (
      <button className="button" type="button" onClick={signOut} title="Sign out">
        {user.avatar ? (
          <img src={user.avatar} alt="" width={22} height={22} style={{ borderRadius: 999 }} />
        ) : (
          <UserRound size={18} aria-hidden="true" />
        )}
        {user.name.split(" ")[0]}
      </button>
    );
  }

  return (
    <div className="auth-actions">
      <button
        className="button primary"
        type="button"
        onClick={() => signIn("linkedin_oidc")}
        title="Continue with LinkedIn"
      >
        <BriefcaseBusiness size={18} aria-hidden="true" />
        {isSupabaseConfigured ? "LinkedIn" : "Preview auth"}
      </button>
      {isSupabaseConfigured && (
        <button className="icon-button" type="button" onClick={() => signIn("google")} title="Continue with Google">
          <LogIn size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
