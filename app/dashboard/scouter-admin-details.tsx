"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ClipboardCopy, Eye, EyeOff, LockKeyhole, Landmark, Upload } from "lucide-react";
import type { ScouterProfile } from "../../lib/dashboard/scouters";

type AdminProfile = ScouterProfile & {
  privateProfile: { patUploaded: boolean; patUpdatedAt: string | null; bankName: string; bankAccountName: string; bankAccountNumber: string; bankUpdatedAt: string | null };
  proofs: Array<{ id: string; filename: string; status: string; created_at: string }>;
};

export default function ScouterAdminDetails({ profile, onRefresh }: { profile: AdminProfile; onRefresh: () => void }) {
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const login = profile.scouter.account_login;
  useEffect(() => { setPat(""); setError(""); setCopied(false); }, [login]);
  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  async function reveal() {
    setBusy("pat"); setError("");
    try {
      const response = await fetch(`/api/scouters/${encodeURIComponent(login)}/pat`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not reveal PAT");
      setPat(body.pat);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reveal PAT"); }
    finally { setBusy(""); }
  }

  async function copyPat() {
    try { await navigator.clipboard.writeText(pat); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError("Clipboard unavailable. Select the revealed PAT to copy it."); }
  }

  async function review(id: string, status: "confirmed" | "rejected" | "pending") {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/scouters/${encodeURIComponent(login)}/proofs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not review proof");
      onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review proof"); }
    finally { setBusy(""); }
  }

  return <div className="scouter-admin-private">
    {error && <p className="scouter-notice error" role="alert">{error}</p>}
    <div className="scouter-admin-private-grid">
      <section><h3><LockKeyhole size={16} /> GitHub PAT</h3><p>{profile.privateProfile.patUploaded ? `Uploaded ${formatDate(profile.privateProfile.patUpdatedAt)}` : "Not uploaded"}</p>
        {profile.privateProfile.patUploaded && <div className="scouter-admin-pat">
          {pat ? <><input type="text" readOnly value={pat} aria-label="Revealed GitHub PAT" /><button type="button" className="button button-white" onClick={copyPat} title="Copy PAT" aria-label="Copy PAT">{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}</button><button type="button" className="button button-white" onClick={() => setPat("")} title="Hide PAT" aria-label="Hide PAT"><EyeOff size={16} /></button></> : <button type="button" className="button button-white" onClick={reveal} disabled={Boolean(busy)}><Eye size={16} /> Reveal PAT</button>}
        </div>}
      </section>
      <section><h3><Landmark size={16} /> Bank details</h3>{profile.privateProfile.bankName ? <dl><dt>Bank</dt><dd>{profile.privateProfile.bankName}</dd><dt>Account name</dt><dd>{profile.privateProfile.bankAccountName}</dd><dt>Account number</dt><dd>{profile.privateProfile.bankAccountNumber}</dd></dl> : <p>Not added</p>}</section>
    </div>
    <section className="scouter-admin-proofs"><h3><Upload size={16} /> Drip Wave withdrawal proofs</h3>{profile.proofs.length ? <ul>{profile.proofs.map((proof) => <li key={proof.id}><a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${proof.id}`} target="_blank" rel="noreferrer">{proof.filename}<ArrowUpRight size={13} /></a><span>{proof.status}</span><time dateTime={proof.created_at}>{formatDate(proof.created_at)}</time><div><button type="button" className="button button-white" disabled={busy === proof.id || proof.status === "confirmed"} onClick={() => review(proof.id, "confirmed")}>Confirm</button><button type="button" className="button button-white" disabled={busy === proof.id || proof.status === "rejected"} onClick={() => review(proof.id, "rejected")}>Reject</button></div></li>)}</ul> : <p>No proof uploaded</p>}</section>
  </div>;
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
export type { AdminProfile };
