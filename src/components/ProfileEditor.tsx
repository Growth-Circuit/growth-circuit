import { Check, ExternalLink, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicProfileInput, PublicProject, ProjectKind } from "@/lib/public-profile";

type EditorProfile = PublicProfileInput & { moderationState: "visible" | "hidden" };
type Props = { csrfToken: string; initialProfile: EditorProfile };
const emptyProject = (): PublicProject => ({ title: "", description: "", url: "", kind: "website" });

export default function ProfileEditor({ csrfToken, initialProfile }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const publicUrl = useMemo(() => `/people/${profile.handle || "your-name"}`, [profile.handle]);
  const update = (field: keyof EditorProfile, value: unknown) => setProfile((current) => ({ ...current, [field]: value }));
  const updateProject = (index: number, field: keyof PublicProject, value: string) => update("projects", profile.projects.map((project, projectIndex) => projectIndex === index ? { ...project, [field]: value } : project));

  async function save(state: "draft" | "published") {
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/profiles/me", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ ...profile, state }) });
      const result = await response.json() as { error?: string; handle?: string; state?: "draft" | "published" };
      if (!response.ok) throw new Error(result.error || "We could not save your profile.");
      setProfile((current) => ({ ...current, handle: result.handle || current.handle, state: result.state || state }));
      setMessage(state === "published" ? "Your profile is live." : "Draft saved.");
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "We could not save your profile."); }
    finally { setSaving(false); }
  }

  return <div className="profile-editor-layout">
    <form className="profile-editor" onSubmit={(event) => { event.preventDefault(); void save("draft"); }}>
      {profile.moderationState === "hidden" && <div className="profile-alert">Your profile is hidden while it is being reviewed. You can still edit and save it.</div>}
      <section className="profile-form-section">
        <div className="profile-section-heading"><span>01</span><div><h2>Claim your name</h2><p>This becomes your public Growth Circuit URL.</p></div></div>
        <div className="application-grid two-col">
          <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" value={profile.firstName} onChange={(event) => update("firstName", event.target.value)} maxLength={80} required /></div>
          <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" value={profile.lastName} onChange={(event) => update("lastName", event.target.value)} maxLength={80} required /></div>
        </div>
        <div className="field"><label htmlFor="handle">Profile handle</label><div className="handle-input"><span>growthcircuit.club/people/</span><input id="handle" value={profile.handle} onChange={(event) => update("handle", event.target.value)} placeholder="your-name" maxLength={40} required /></div></div>
        <div className="field"><label htmlFor="headline">Headline</label><input id="headline" value={profile.headline} onChange={(event) => update("headline", event.target.value)} placeholder="Growth engineer building useful systems" maxLength={140} /></div>
        <div className="field"><label htmlFor="bio">Short bio</label><textarea id="bio" value={profile.bio} onChange={(event) => update("bio", event.target.value)} placeholder="What do you build, and what are you curious about?" maxLength={1000} rows={5} /></div>
        <div className="application-grid two-col">
          <div className="field"><label htmlFor="location">Location</label><input id="location" value={profile.location} onChange={(event) => update("location", event.target.value)} placeholder="Brooklyn, NY" maxLength={100} /></div>
          <div className="field"><label htmlFor="websiteUrl">Website</label><input id="websiteUrl" type="url" value={profile.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://your-site.com" maxLength={500} /></div>
        </div>
      </section>

      <section className="profile-form-section">
        <div className="profile-section-heading"><span>02</span><div><h2>Projects</h2><p>Add projects you have shipped, experiments you have run, or templates you have built. If your work lives in a folder, Doorway can publish it as a project page.</p></div></div>
        <div className="project-editor-list">
          {profile.projects.map((project, index) => <article className="project-editor-card" key={index}>
            <div className="project-editor-card__top"><span><GripVertical size={16} aria-hidden="true" /> Project {String(index + 1).padStart(2, "0")}</span><button type="button" className="icon-button" aria-label={`Remove project ${index + 1}`} onClick={() => update("projects", profile.projects.filter((_, projectIndex) => projectIndex !== index))}><Trash2 size={17} /></button></div>
            <div className="application-grid two-col"><div className="field"><label htmlFor={`project-title-${index}`}>Title</label><input id={`project-title-${index}`} value={project.title} onChange={(event) => updateProject(index, "title", event.target.value)} maxLength={120} required /></div><div className="field"><label htmlFor={`project-kind-${index}`}>Type</label><select id={`project-kind-${index}`} value={project.kind} onChange={(event) => updateProject(index, "kind", event.target.value as ProjectKind)}><option value="website">Website</option><option value="github">GitHub</option><option value="doorway">Doorway</option><option value="demo">Demo</option></select></div></div>
            <div className="field"><label htmlFor={`project-url-${index}`}>URL</label><input id={`project-url-${index}`} type="url" value={project.url} onChange={(event) => updateProject(index, "url", event.target.value)} placeholder="https://" maxLength={500} required /></div>
            <div className="field"><label htmlFor={`project-description-${index}`}>What did you build?</label><textarea id={`project-description-${index}`} value={project.description} onChange={(event) => updateProject(index, "description", event.target.value)} maxLength={500} rows={3} required /></div>
          </article>)}
        </div>
        {profile.projects.length < 12 && <button className="button profile-add-button" type="button" onClick={() => update("projects", [...profile.projects, emptyProject()])}><Plus size={17} /> Add a project</button>}
      </section>

      <div className="profile-editor-actions">
        <button className="button profile-secondary-button" type="submit" disabled={saving}>{saving ? <Loader2 size={17} /> : <Save size={17} />} Save draft</button>
        <button className="button matcha" type="button" disabled={saving || profile.moderationState === "hidden"} onClick={() => void save("published")}><Check size={17} /> Publish profile</button>
        {profile.state === "published" && <a className="profile-view-link" href={publicUrl} target="_blank">View profile <ExternalLink size={15} /></a>}
      </div>
      {message && <div className={`status-message ${error ? "error" : "success"}`} role="status">{message}</div>}
    </form>
  </div>;
}
