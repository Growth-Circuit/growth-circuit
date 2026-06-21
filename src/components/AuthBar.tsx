import { LogIn, UserRound } from "lucide-react";
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
    <a className="button primary" href="/auth" title="Sign in">
      <LogIn size={18} aria-hidden="true" />
      {isSupabaseConfigured ? "Sign in" : "Preview auth"}
    </a>
  );
}
