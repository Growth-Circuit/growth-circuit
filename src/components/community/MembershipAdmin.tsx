import { useCallback, useEffect, useState } from "react";
import type { CommunityMembershipStatus } from "@/types/community";

type MembershipStatus = CommunityMembershipStatus | null;
type Member = {
  userId: string;
  name: string;
  status: MembershipStatus;
  joinedAt: string;
  membershipUpdatedAt: string | null;
};

type Notice = { kind: "success" | "error"; message: string } | null;
type MembershipAction = { status: Exclude<MembershipStatus, null>; label: string; consequence: string };

const ACTIONS: Record<"active" | "suspended" | "revoked" | "none", MembershipAction[]> = {
  active: [
    { status: "suspended", label: "Suspend", consequence: "They will lose Members access immediately. You can restore it later." },
    { status: "revoked", label: "Revoke", consequence: "They will lose Members access immediately. A future grant will create a new approval decision." },
  ],
  suspended: [
    { status: "active", label: "Restore", consequence: "They will regain Members access on their next request." },
    { status: "revoked", label: "Revoke", consequence: "Their suspended membership will become revoked." },
  ],
  revoked: [{ status: "active", label: "Grant membership", consequence: "They will gain access to the private Members feed on their next request." }],
  none: [{ status: "active", label: "Grant membership", consequence: "They will gain access to the private Members feed on their next request." }],
};

function statusLabel(status: MembershipStatus) {
  if (!status) return "Contributor";
  return status[0].toUpperCase() + status.slice(1);
}

export default function MembershipAdmin({ csrfToken }: { csrfToken: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/community/admin/members", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as { members?: Member[]; error?: { message?: string; recoveryPath?: string } };
      if (!response.ok || !result.members) {
        if (result.error?.recoveryPath) window.location.assign(result.error.recoveryPath);
        throw new Error(result.error?.message || "We could not load contributors.");
      }
      setMembers(result.members);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We could not load contributors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeMembership(member: Member, action: MembershipAction) {
    const reason = (reasons[member.userId] || "").trim();
    if (!reason) {
      setNotice({ kind: "error", message: `Add a reason before changing ${member.name}'s membership.` });
      return;
    }
    if (!window.confirm(`${action.label} for ${member.name}? ${action.consequence}`)) return;

    setPendingUserId(member.userId);
    setNotice(null);
    try {
      const response = await fetch(`/api/community/admin/members/${member.userId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ status: action.status, reason, requestId: crypto.randomUUID() }),
      });
      const result = await response.json() as { changed?: boolean; error?: { message?: string; recoveryPath?: string } };
      if (!response.ok) {
        if (result.error?.recoveryPath) window.location.assign(result.error.recoveryPath);
        throw new Error(result.error?.message || "The membership was not changed.");
      }
      setMembers((current) => current.map((item) => item.userId === member.userId
        ? { ...item, status: action.status, membershipUpdatedAt: new Date().toISOString() }
        : item));
      setReasons((current) => ({ ...current, [member.userId]: "" }));
      setNotice({
        kind: "success",
        message: result.changed === false
          ? `${member.name} was already ${statusLabel(action.status).toLowerCase()}. No duplicate change was recorded.`
          : `${member.name} is now ${statusLabel(action.status).toLowerCase()}. The change takes effect on their next request.`,
      });
    } catch (error) {
      setNotice({ kind: "error", message: `${error instanceof Error ? error.message : "The membership was not changed."} Check the current status and try again.` });
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="membership-admin">
      <div className="admin-notice" aria-live="polite">
        {notice && <p className={`admin-notice__${notice.kind}`}>{notice.message}</p>}
      </div>

      {loading && <p aria-live="polite">Loading verified contributors…</p>}
      {loadError && (
        <div className="admin-recovery" role="alert">
          <p>{loadError}</p>
          <button className="button" type="button" onClick={() => void load()}>Try again</button>
        </div>
      )}
      {!loading && !loadError && members.length === 0 && <p>No verified contributors are waiting yet.</p>}

      <div className="member-list">
        {members.map((member) => {
          const pending = pendingUserId === member.userId;
          return (
            <section className="member-row" key={member.userId} aria-busy={pending}>
              <div className="member-row__identity">
                <h2>{member.name}</h2>
                <p><span className={`status status--${member.status || "contributor"}`}>{statusLabel(member.status)}</span></p>
                <p className="member-row__date">Verified {new Date(member.joinedAt).toLocaleDateString()}</p>
              </div>
              <div className="member-row__controls">
                <label htmlFor={`reason-${member.userId}`}>Reason for this change</label>
                <input
                  id={`reason-${member.userId}`}
                  value={reasons[member.userId] || ""}
                  disabled={pending}
                  maxLength={500}
                  onChange={(event) => setReasons((current) => ({ ...current, [member.userId]: event.target.value }))}
                  placeholder="Keep the audit note short and specific"
                />
                <div className="member-row__actions">
                  {ACTIONS[member.status || "none"].map((action) => (
                    <button
                      className={action.status === "revoked" ? "button button--danger" : "button"}
                      disabled={pending}
                      key={action.status}
                      onClick={() => void changeMembership(member, action)}
                      type="button"
                    >
                      {pending ? "Saving…" : action.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <style>{`
        .membership-admin { display: grid; gap: 20px; }
        .admin-notice { min-height: 24px; }
        .admin-notice p, .admin-recovery { margin: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
        .admin-notice__success { color: var(--matcha-ink); }
        .admin-notice__error { color: #ffc1b7; }
        .admin-recovery { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .member-list { display: grid; gap: 14px; }
        .member-row { display: grid; grid-template-columns: minmax(180px, .7fr) minmax(260px, 1.3fr); gap: 24px; padding: 20px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); }
        .member-row h2 { margin: 0 0 10px; font-size: 20px; }
        .member-row p { margin: 0; }
        .member-row__date { margin-top: 10px !important; color: var(--muted); font-size: 13px; }
        .status { display: inline-flex; padding: 5px 9px; border-radius: 999px; background: var(--surface-field); color: var(--ink-2); font-size: 12px; font-weight: 750; }
        .status--active { background: var(--matcha); color: var(--ink); }
        .status--suspended { background: #d8a45f; color: var(--ink); }
        .status--revoked { background: var(--tomato); color: var(--ink); }
        .member-row__controls { display: grid; gap: 8px; }
        .member-row__controls label { color: var(--ink-2); font-size: 13px; font-weight: 700; }
        .member-row__controls input { width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: 10px; padding: 0 12px; background: var(--surface-field); color: var(--porcelain); }
        .member-row__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .button--danger { border-color: rgba(var(--tomato-rgb), .6); color: #ffc1b7; }
        @media (max-width: 700px) { .member-row { grid-template-columns: 1fr; gap: 16px; } .admin-recovery { align-items: flex-start; flex-direction: column; } }
      `}</style>
    </div>
  );
}
