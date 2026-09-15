"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, ClipboardCopy, GitBranch, Landmark, LockKeyhole, Upload } from "lucide-react";
import type { ScouterProfile } from "../../lib/dashboard/scouters";
const WITHDRAWAL_ADDRESS = "GAZB64YEKBGODTQA2FTPYS5Y2IOZ75EEQSDMDIWWMP2X3YI4YIVWOFDY";

type PrivateState = { patUploaded: boolean; patUpdatedAt: string | null; bankName: string; bankAccountName: string; bankAccountNumber: string; bankUpdatedAt: string | null };
type Proof = { id: string; filename: string; status: string; created_at: string; reviewed_at: string | null };
type PortalData = { work: ScouterProfile | null; profile: PrivateState; proofs: Proof[] };

export default function ScouterPortal() {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [pat, setPat] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/me/scouter", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load your workspace");
    const next = body as PortalData;
    setData(next);
    setBankName(next.profile.bankName);
    setAccountName(next.profile.bankAccountName);
    setAccountNumber(next.profile.bankAccountNumber);
  }, []);

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>, kind: "pat" | "bank") {
    event.preventDefault();
    setBusy(kind); setError(""); setMessage("");
    try {
      const response = await fetch("/api/me/scouter", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "pat" ? { kind, pat } : { kind, bankName, accountName, accountNumber }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save your details");
      setPat("");
      await load();
      setMessage(kind === "pat" ? "PAT saved. Authorized admins can reveal it for assigned issue work." : "Bank details saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your details"); }
    finally { setBusy(""); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof) return;
    setBusy("proof"); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("proof", proof);
      const response = await fetch("/api/me/scouter/proofs", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not upload proof");
      setProof(null);
      const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) input.value = "";
      await load(); setMessage("Withdrawal proof uploaded for admin review.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not upload proof"); }
    finally { setBusy(""); }
  }

  async function copyAddress() {
    try { await navigator.clipboard.writeText(WITHDRAWAL_ADDRESS); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError("Could not copy the public key. Select it below to copy manually."); }
  }

  if (!data && !error) return <div className="scouter-loading" role="status">Loading your workspace...</div>;
  if (!data) return <div className="scouter-loading" role="alert">{error}</div>;
  const { work, profile, proofs } = data;
  if (!work) return <div className="scouter-loading" role="alert">This GitHub account has no personal Plinger installation yet.</div>;
  const login = work.scouter.account_login;
  const issues = [...work.openIssues.data, ...work.closedIssues.data].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const prs = [...work.openPullRequests.data, ...work.mergedPullRequests.data, ...work.closedPullRequests.data].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return <div className="scouter-main">
    <div className="scouter-page-heading"><div><p className="overline">SCOUTER WORKSPACE</p><h1>{login}</h1><p>Your GitHub work and withdrawal details</p></div><a href={`https://github.com/${login}`} target="_blank" rel="noreferrer" className="button button-white"><GitBranch size={16} /> GitHub <ArrowUpRight size={14} /></a></div>
    {(error || message) && <p className={`scouter-notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || message}</p>}

    <section className="scouter-band" aria-labelledby="work-heading"><div className="scouter-band-heading"><h2 id="work-heading">Your work</h2><span>{work.openIssues.count} open issues, {work.openPullRequests.count} open PRs, {work.mergedPullRequests.count} merged</span></div>
      <div className="scouter-work-grid"><div><h3>Assigned issues</h3>{issues.length ? <ul className="scouter-work-list">{issues.map((issue) => <li key={issue.id}><a href={issue.url || "#"} target="_blank" rel="noreferrer">#{issue.github_issue_number} {issue.title}<ArrowUpRight size={13} /></a><span>{issue.state}</span></li>)}</ul> : <p className="muted">No assigned issues recorded.</p>}</div>
      <div><h3>Your pull requests</h3>{prs.length ? <ul className="scouter-work-list">{prs.map((pr) => <li key={pr.id}><a href={pr.url || "#"} target="_blank" rel="noreferrer">#{pr.github_pull_request_number} {pr.title}<ArrowUpRight size={13} /></a><span>{pr.merged ? "Merged" : pr.state}</span></li>)}</ul> : <p className="muted">No pull requests recorded.</p>}</div></div>
    </section>

    <section className="scouter-band" aria-labelledby="pat-heading"><div className="scouter-band-heading"><h2 id="pat-heading"><LockKeyhole size={18} /> GitHub PAT</h2><span>{profile.patUploaded ? `Uploaded ${formatDate(profile.patUpdatedAt)}` : "Not uploaded"}</span></div>
      <form className="scouter-form" onSubmit={(event) => save(event, "pat")}><label htmlFor="scouter-pat">Personal access token</label><input id="scouter-pat" type="password" autoComplete="off" value={pat} onChange={(event) => setPat(event.target.value)} required placeholder={profile.patUploaded ? "Replace existing PAT" : "github_pat_..."} />
        <p className="scouter-consent">Your GitHub Personal Access Token will be visible to authorized admins so they can authenticate the CLI and push fixes for issues assigned to you.</p>
        <button type="submit" className="button button-black" disabled={Boolean(busy)}>{profile.patUploaded ? "Replace PAT" : "Upload PAT"}</button></form>
    </section>

    <section className="scouter-band" aria-labelledby="destination-heading"><div className="scouter-band-heading"><h2 id="destination-heading">Drip Wave withdrawal</h2><span>Stellar public key</span></div>
      <p className="scouter-destination-copy">On Drip Wave, withdraw to this public key. No memo is required.</p>
      <div className="scouter-address"><code>{WITHDRAWAL_ADDRESS}</code><button type="button" className="button button-white" onClick={copyAddress} aria-label="Copy Drip Wave withdrawal public key" title="Copy public key">{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}</button></div>
    </section>

    <section className="scouter-band" aria-labelledby="bank-heading"><div className="scouter-band-heading"><h2 id="bank-heading"><Landmark size={18} /> Bank withdrawal details</h2><span>{profile.bankUpdatedAt ? `Updated ${formatDate(profile.bankUpdatedAt)}` : "Not added"}</span></div>
      <form className="scouter-form scouter-bank-form" onSubmit={(event) => save(event, "bank")}><label>Bank name<input value={bankName} onChange={(event) => setBankName(event.target.value)} maxLength={120} required /></label><label>Name on account<input value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={120} required /></label><label>Account number<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" pattern="[0-9]{6,20}" required /></label><button type="submit" className="button button-black" disabled={Boolean(busy)}>Save bank details</button></form>
    </section>

    <section className="scouter-band" aria-labelledby="proof-heading"><div className="scouter-band-heading"><h2 id="proof-heading"><Upload size={18} /> Withdrawal proof</h2><span>{proofs.length} submitted</span></div>
      <form className="scouter-form scouter-proof-form" onSubmit={upload}><label htmlFor="scouter-proof">Drip Wave withdrawal confirmation</label><input id="scouter-proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setProof(event.target.files?.[0] || null)} required /><button type="submit" className="button button-black" disabled={!proof || Boolean(busy)}>Upload proof</button></form>
      {proofs.length > 0 && <ul className="scouter-proof-list">{proofs.map((item) => <li key={item.id}><a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${item.id}`} target="_blank" rel="noreferrer">{item.filename}<ArrowUpRight size={13} /></a><span>{item.status}</span><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></li>)}</ul>}
    </section>
  </div>;
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
