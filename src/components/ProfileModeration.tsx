import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";

type Profile = { id: string; firstName: string; lastName: string; handle: string; headline: string; state: "visible" | "hidden"; projectCount: number };
export default function ProfileModeration({ csrfToken, initialProfiles }: { csrfToken: string; initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles); const [busy, setBusy] = useState(""); const [message, setMessage] = useState("");
  async function moderate(profile: Profile) {
    const nextState = profile.state === "visible" ? "hidden" : "visible";
    const reason = window.prompt(`Why should this profile be ${nextState}?`);
    if (!reason?.trim()) return;
    setBusy(profile.id); setMessage("");
    const response = await fetch("/api/profiles/moderate", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ profileId: profile.id, state: nextState, reason, requestId: crypto.randomUUID() }) });
    const result = await response.json() as { error?: string };
    if (response.ok) setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, state: nextState } : item));
    else setMessage(result.error || "We could not update that profile.");
    setBusy("");
  }
  return <div className="moderation-list">{message && <div className="status-message error">{message}</div>}{profiles.map((profile) => <article className="moderation-row" key={profile.id}><div><span>@{profile.handle} · {profile.projectCount} projects</span><h2>{profile.firstName} {profile.lastName}</h2><p>{profile.headline}</p></div><button className="button profile-secondary-button" type="button" disabled={busy === profile.id} onClick={() => void moderate(profile)}>{busy === profile.id ? <Loader2 size={17} /> : profile.state === "visible" ? <EyeOff size={17} /> : <Eye size={17} />}{profile.state === "visible" ? "Hide" : "Restore"}</button></article>)}</div>;
}
