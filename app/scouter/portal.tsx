"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, ClipboardCopy, CircleDot, GitMerge, GitPullRequest, Landmark, LockKeyhole, Pencil, RefreshCw, Search, Upload } from "lucide-react";
import type { ScouterProfile } from "../../lib/dashboard/scouters";
import ScouterWorkspace, { scouterViews, type ScouterView } from "./workspace";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
  const [view, setView] = useState<ScouterView>("overview");
  const [query, setQuery] = useState("");
  const [workStatus, setWorkStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [editingPat, setEditingPat] = useState(false);

  useEffect(() => {
    const sync = () => { const id = window.location.hash.slice(1); setView(scouterViews.some((item) => item.id === id) ? id as ScouterView : "overview"); };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function navigate(next: ScouterView) { setView(next); window.location.hash = next; }

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

  async function refresh() {
    setRefreshing(true); setError("");
    try { await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh your workspace"); }
    finally { setRefreshing(false); }
  }

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
      if (kind === "pat") setEditingPat(false);
      else setEditingBank(false);
      setMessage(kind === "pat" ? "PAT saved. Authorized admins can reveal it for assigned issue work." : "Bank details saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your details"); }
    finally { setBusy(""); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uploadForm = event.currentTarget;
    if (!proof) return;
    setBusy("proof"); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("proof", proof);
      const response = await fetch("/api/me/scouter/proofs", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not upload proof");
      setProof(null);
      const input = uploadForm.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) input.value = "";
      await load(); setMessage("Withdrawal proof uploaded for admin review.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not upload proof"); }
    finally { setBusy(""); }
  }

  async function copyAddress() {
    try { await navigator.clipboard.writeText(WITHDRAWAL_ADDRESS); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError("Could not copy the public key. Select it below to copy manually."); }
  }

  if (!data) return <ScouterWorkspace view={view} navigate={navigate}><div className="scouter-loading" role={error ? "alert" : "status"}>{error || "Loading your workspace..."}{error && <button type="button" className="button button-white" disabled={refreshing} onClick={refresh}><RefreshCw size={16} /> Retry</button>}</div></ScouterWorkspace>;
  const { work, profile, proofs } = data;
  if (!work) return <ScouterWorkspace view={view} navigate={navigate}><div className="scouter-loading" role="alert">This GitHub account has no personal Plinger installation yet.</div></ScouterWorkspace>;
  const login = work.scouter.account_login;
  const matches = (title: string, status: string) => title.toLowerCase().includes(query.toLowerCase()) && (workStatus === "all" || workStatus === status);
  const issues = [...work.openIssues.data, ...work.closedIssues.data].filter((item) => matches(item.title, item.state)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const prs = [...work.openPullRequests.data, ...work.mergedPullRequests.data, ...work.closedPullRequests.data].filter((item) => matches(item.title, item.merged ? "merged" : item.state)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const pendingProofs = proofs.filter((item) => item.status === "pending").length;
  const title = scouterViews.find((item) => item.id === view)!.label;

  return <ScouterWorkspace view={view} navigate={navigate} login={login} accountId={work.scouter.account_id}>
    <div className="page-heading"><div><p className="overline">SCOUTER WORKSPACE</p><h1>{title}</h1></div><div className="heading-actions"><button type="button" className="button button-white" onClick={refresh} disabled={refreshing || Boolean(busy)}><RefreshCw size={15} className={refreshing ? "spinning" : ""} /> Refresh</button><a href={`https://github.com/${login}`} target="_blank" rel="noreferrer" className="button button-black"><img src="/github-mark-white.svg" width={16} height={16} alt="" /> GitHub <ArrowUpRight size={14} /></a></div></div>
    {(error || message) && <p className={`scouter-notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || message}</p>}

    {view === "overview" && <>
      <div className="metrics scouter-overview-metrics">{[
        { label: "Open issues", count: work.openIssues.count, icon: CircleDot, tone: "green" },
        { label: "Open pull requests", count: work.openPullRequests.count, icon: GitPullRequest, tone: "blue" },
        { label: "Merged pull requests", count: work.mergedPullRequests.count, icon: GitMerge, tone: "purple" },
        { label: "Proofs pending review", count: pendingProofs, icon: Upload, tone: "amber" },
      ].map(({ label, count, icon: Icon, tone }) => <button key={label} type="button" className="metric" onClick={() => navigate(tone === "amber" ? "withdrawals" : "work")}><span className="metric-top">{label}<Icon size={18} aria-hidden="true" /></span><span className="metric-value"><strong>{count}</strong></span></button>)}</div>
      <section className="scouter-band scouter-overview-section"><div className="scouter-band-heading"><h2>Account setup</h2><span>{Number(profile.patUploaded) + Number(Boolean(profile.bankUpdatedAt))} of 2 complete</span></div><div className="scouter-setup-list">
        <button type="button" onClick={() => navigate("pat")}><LockKeyhole size={20} aria-hidden="true" /><span><strong>GitHub PAT</strong><small>{profile.patUploaded ? `Updated ${formatDate(profile.patUpdatedAt)}` : "Upload your personal access token"}</small></span><span className={`badge ${profile.patUploaded ? "green" : "amber"}`}>{profile.patUploaded ? "Uploaded" : "Required"}</span><ArrowUpRight size={16} /></button>
        <button type="button" onClick={() => navigate("withdrawals")}><Landmark size={20} aria-hidden="true" /><span><strong>Bank details</strong><small>{profile.bankName || "Add your withdrawal account"}</small></span><span className={`badge ${profile.bankUpdatedAt ? "green" : "amber"}`}>{profile.bankUpdatedAt ? "Added" : "Required"}</span><ArrowUpRight size={16} /></button>
      </div></section>
      <section className="scouter-band"><div className="scouter-band-heading"><h2>Recent withdrawal proofs</h2><button type="button" className="button button-white" onClick={() => navigate("withdrawals")}>View withdrawals <ArrowUpRight size={14} /></button></div>{proofs.length ? <ul className="scouter-proof-list">{proofs.slice(0, 5).map((item) => <li key={item.id}><a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${item.id}`} target="_blank" rel="noreferrer">{item.filename}<ArrowUpRight size={13} /></a><span className={`badge ${item.status === "confirmed" ? "green" : item.status === "rejected" ? "red" : "amber"}`}>{item.status}</span><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></li>)}</ul> : <p className="scouter-empty-line">No withdrawal proofs submitted yet.</p>}</section>
    </>}

    {view === "work" && <>
    <div className="scouter-work-toolbar"><div className="scouter-work-search"><Search size={16} aria-hidden="true" /><Input type="search" aria-label="Search your work" placeholder="Search issues and pull requests" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Select value={workStatus} onValueChange={setWorkStatus}><SelectTrigger className="scouter-work-status" aria-label="Work status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="merged">Merged</SelectItem></SelectContent></Select></div>
    <section className="scouter-band" aria-labelledby="work-heading"><div className="scouter-band-heading"><h2 id="work-heading">Your work</h2><span>{work.openIssues.count} open issues, {work.openPullRequests.count} open PRs, {work.mergedPullRequests.count} merged</span></div>
      <div className="scouter-work-grid"><div><h3>Assigned issues</h3>{issues.length ? <ul className="scouter-work-list">{issues.map((issue) => <li key={issue.id}><a href={issue.url || "#"} target="_blank" rel="noreferrer">#{issue.github_issue_number} {issue.title}<ArrowUpRight size={13} /></a><span>{issue.state}</span></li>)}</ul> : <p className="muted">No assigned issues recorded.</p>}</div>
      <div><h3>Your pull requests</h3>{prs.length ? <ul className="scouter-work-list">{prs.map((pr) => <li key={pr.id}><a href={pr.url || "#"} target="_blank" rel="noreferrer">#{pr.github_pull_request_number} {pr.title}<ArrowUpRight size={13} /></a><span>{pr.merged ? "Merged" : pr.state}</span></li>)}</ul> : <p className="muted">No pull requests recorded.</p>}</div></div>
    </section>
    </>}

    {view === "pat" &&
    <section className="scouter-band" aria-labelledby="pat-heading"><div className="scouter-band-heading"><h2 id="pat-heading"><LockKeyhole size={18} /> GitHub PAT</h2><span>{profile.patUploaded ? `Uploaded ${formatDate(profile.patUpdatedAt)}` : "Not uploaded"}</span></div>
      {profile.patUploaded && !editingPat ? <div className="scouter-saved-pat"><span><Check size={18} aria-hidden="true" /> Personal access token added</span><button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { setPat(""); setEditingPat(true); setError(""); setMessage(""); }}><Pencil size={15} aria-hidden="true" /> Update PAT</button></div> :
      <form className="scouter-form" onSubmit={(event) => save(event, "pat")}><label htmlFor="scouter-pat">Personal access token</label><Input id="scouter-pat" type="password" autoComplete="off" autoFocus={editingPat} disabled={Boolean(busy)} aria-describedby="pat-consent" value={pat} onChange={(event) => setPat(event.target.value)} required placeholder={profile.patUploaded ? "Replace existing PAT" : "github_pat_..."} />
        <p id="pat-consent" className="scouter-consent">Your GitHub Personal Access Token will be visible to authorized admins so they can authenticate the CLI and push fixes for issues assigned to you.</p>
        <div className="scouter-form-actions"><button type="submit" className="button button-black" disabled={Boolean(busy)}>{busy === "pat" ? "Saving PAT..." : profile.patUploaded ? "Update PAT" : "Upload PAT"}</button>{profile.patUploaded && <button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { setPat(""); setEditingPat(false); setError(""); }}>Cancel</button>}</div></form>}
    </section>}

    {view === "withdrawals" && <>
    <section className="scouter-band" aria-labelledby="destination-heading"><div className="scouter-band-heading"><h2 id="destination-heading">Drip Wave withdrawal</h2><span>Stellar public key</span></div>
      <p className="scouter-destination-copy">On Drip Wave, withdraw to this public key. No memo is required.</p>
      <div className="scouter-address"><code>{WITHDRAWAL_ADDRESS}</code><button type="button" className="button button-white" onClick={copyAddress} aria-label="Copy Drip Wave withdrawal public key" title="Copy public key">{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}</button></div>
    </section>

    <section className="scouter-band" aria-labelledby="bank-heading"><div className="scouter-band-heading"><h2 id="bank-heading"><Landmark size={18} /> Bank withdrawal details</h2><span>{profile.bankUpdatedAt ? `Updated ${formatDate(profile.bankUpdatedAt)}` : "Not added"}</span></div>
      {profile.bankUpdatedAt && !editingBank ? <div className="scouter-saved-bank"><dl><div><dt>Bank name</dt><dd>{profile.bankName}</dd></div><div><dt>Name on account</dt><dd>{profile.bankAccountName}</dd></div><div><dt>Account number</dt><dd>{profile.bankAccountNumber}</dd></div></dl><button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { setBankName(profile.bankName); setAccountName(profile.bankAccountName); setAccountNumber(profile.bankAccountNumber); setEditingBank(true); setError(""); setMessage(""); }}><Pencil size={15} aria-hidden="true" /> Edit bank details</button></div> :
      <form className="scouter-form scouter-bank-form" onSubmit={(event) => save(event, "bank")}><label>Bank name<Input autoFocus={editingBank} disabled={Boolean(busy)} value={bankName} onChange={(event) => setBankName(event.target.value)} maxLength={120} required /></label><label>Name on account<Input disabled={Boolean(busy)} value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={120} required /></label><label>Account number<Input disabled={Boolean(busy)} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" pattern="[0-9]{6,20}" required /></label><div className="scouter-form-actions"><button type="submit" className="button button-black" disabled={Boolean(busy)}>{busy === "bank" ? "Saving bank details..." : "Save bank details"}</button>{profile.bankUpdatedAt && <button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { setBankName(profile.bankName); setAccountName(profile.bankAccountName); setAccountNumber(profile.bankAccountNumber); setEditingBank(false); setError(""); }}>Cancel</button>}</div></form>}
    </section>

    <section className="scouter-band" aria-labelledby="proof-heading"><div className="scouter-band-heading"><h2 id="proof-heading"><Upload size={18} /> Withdrawal proof</h2><span>{proofs.length} submitted</span></div>
      <form className="scouter-form scouter-proof-form" onSubmit={upload}><label htmlFor="scouter-proof">Drip Wave withdrawal confirmation</label><input id="scouter-proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setProof(event.target.files?.[0] || null)} required /><button type="submit" className="button button-black" disabled={!proof || Boolean(busy)}>Upload proof</button></form>
      {proofs.length > 0 && <ul className="scouter-proof-list">{proofs.map((item) => <li key={item.id}><a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${item.id}`} target="_blank" rel="noreferrer">{item.filename}<ArrowUpRight size={13} /></a><span>{item.status}</span><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></li>)}</ul>}
    </section>
    </>}
  </ScouterWorkspace>;
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
