import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function AuthCallback() {
  const [message, setMessage] = useState("Finishing sign-in.");

  useEffect(() => {
    async function finishSignIn() {
      const supabase = createBrowserSupabaseClient();

      if (!supabase) {
        setMessage("Supabase is not configured yet.");
        window.setTimeout(() => window.location.replace("/"), 900);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Signed in. Sending you back.");
      window.setTimeout(() => window.location.replace("/apply"), 500);
    }

    finishSignIn();
  }, []);

  return <p className="lead">{message}</p>;
}
