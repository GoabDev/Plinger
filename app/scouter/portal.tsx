"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowUpRight, BadgeDollarSign, Check, ClipboardCopy, CircleDot, GitMerge, GitPullRequest, Landmark, LockKeyhole, Pencil, RefreshCw, Search, Upload, WalletCards } from "lucide-react";
import { bankDetailsSchema, githubPatSchema, withdrawalProofFormSchema, type BankDetailsInput, type GithubPatInput, type WithdrawalProofFormInput } from "../../lib/scouter/contracts";
import { getScouterPortal, scouterPortalQueryKey, updateScouterProfile, uploadWithdrawalProof } from "../../lib/scouter/client";
import ScouterWorkspace, { scouterViews, type ScouterView } from "./workspace";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { formatNaira, formatUsd, splitEarnings } from "../../lib/scouter/money";
const WITHDRAWAL_ADDRESS = "GAZB64YEKBGODTQA2FTPYS5Y2IOZ75EEQSDMDIWWMP2X3YI4YIVWOFDY";

export default function ScouterPortal() {
  const queryClient = useQueryClient();
  const portalQuery = useQuery({ queryKey: scouterPortalQueryKey, queryFn: getScouterPortal, gcTime: 0 });
  const data = portalQuery.data;
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<ScouterView>("overview");
  const [query, setQuery] = useState("");
  const [workStatus, setWorkStatus] = useState("all");
  const [workTab, setWorkTab] = useState<"issues" | "pull-requests">("issues");
  const [editingBank, setEditingBank] = useState(false);
  const [editingPat, setEditingPat] = useState(false);
  const patForm = useForm<GithubPatInput>({
    resolver: zodResolver(githubPatSchema),
    defaultValues: { kind: "pat", pat: "" },
  });
  const bankForm = useForm<BankDetailsInput>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: { kind: "bank", bankName: "", accountName: "", accountNumber: "" },
  });
  const proofForm = useForm<WithdrawalProofFormInput>({
    resolver: zodResolver(withdrawalProofFormSchema),
    mode: "onChange",
  });

  const profileMutation = useMutation({
    mutationFn: updateScouterProfile,
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({ queryKey: scouterPortalQueryKey });
      setError("");
      if (input.kind === "pat") {
        patForm.reset();
        setEditingPat(false);
        setMessage("PAT saved. Authorized admins can reveal it for assigned issue work.");
      } else {
        setEditingBank(false);
        setMessage("Bank details saved.");
      }
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Could not save your details"),
  });
  const proofMutation = useMutation({
    mutationFn: uploadWithdrawalProof,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scouterPortalQueryKey });
      proofForm.reset();
      setError("");
      setMessage("Earning verified and submitted for admin review.");
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Could not upload proof"),
  });
  const busy = profileMutation.isPending ? profileMutation.variables?.kind ?? "profile" : proofMutation.isPending ? "proof" : "";
  const refreshing = portalQuery.isFetching;

  useEffect(() => {
    const sync = () => { const id = window.location.hash.slice(1); setView(scouterViews.some((item) => item.id === id) ? id as ScouterView : "overview"); };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function navigate(next: ScouterView) { setView(next); window.location.hash = next; }

  useEffect(() => {
    if (!data) return;
    bankForm.reset({
      kind: "bank",
      bankName: data.profile.bankName,
      accountName: data.profile.bankAccountName,
      accountNumber: data.profile.bankAccountNumber,
    });
  }, [bankForm, data]);

  useEffect(() => {
    if (!data || (!error && !message)) return;
    const timeout = window.setTimeout(() => { setError(""); setMessage(""); }, 6000);
    return () => window.clearTimeout(timeout);
  }, [data, error, message]);

  async function refresh() {
    setError("");
    const result = await portalQuery.refetch();
    if (result.error) setError(result.error instanceof Error ? result.error.message : "Could not refresh your workspace");
  }

  async function copyAddress() {
    try { await navigator.clipboard.writeText(WITHDRAWAL_ADDRESS); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError("Could not copy the public key. Select it below to copy manually."); }
  }

  if (!data) {
    const loadError = error || (portalQuery.error instanceof Error ? portalQuery.error.message : "");
    return <ScouterWorkspace view={view} navigate={navigate}><div className="scouter-loading" role={loadError ? "alert" : "status"}>{loadError || "Loading your workspace..."}{loadError && <button type="button" className="button button-white" disabled={refreshing} onClick={refresh}><RefreshCw size={16} /> Retry</button>}</div></ScouterWorkspace>;
  }
  const { work, profile, proofs } = data;
  if (!work) return <ScouterWorkspace view={view} navigate={navigate}><div className="scouter-loading" role="alert">This GitHub account has no personal Plinger installation yet.</div></ScouterWorkspace>;
  const login = work.scouter.account_login;
  const matches = (title: string, status: string) => title.toLowerCase().includes(query.toLowerCase()) && (workStatus === "all" || workStatus === status);
  const issues = [...work.openIssues.data, ...work.closedIssues.data].filter((item) => matches(item.title, item.state)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const prs = [...work.openPullRequests.data, ...work.mergedPullRequests.data, ...work.closedPullRequests.data].filter((item) => matches(item.title, item.merged ? "merged" : item.state)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const pendingProofs = proofs.filter((item) => item.status === "pending").length;
  const confirmedProofs = proofs.filter((item) => item.status === "confirmed" && item.amount_stroops);
  const confirmedGross = confirmedProofs.reduce((sum, item) => sum + BigInt(item.amount_stroops ?? "0"), BigInt(0));
  const confirmedShare = splitEarnings(confirmedGross).scouter;
  const paidShare = confirmedProofs.filter((item) => item.payout_status === "paid").reduce((sum, item) => sum + splitEarnings(item.amount_stroops ?? "0").scouter, BigInt(0));
  const outstandingShare = confirmedShare - paidShare;
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
      ].map(({ label, count, icon: Icon, tone }) => <button key={label} type="button" className="metric" onClick={() => navigate(tone === "amber" ? "earnings" : "work")}><span className="metric-top">{label}<Icon size={18} aria-hidden="true" /></span><span className="metric-value"><strong>{count}</strong></span></button>)}</div>
      <section className="scouter-band scouter-overview-section"><div className="scouter-band-heading"><h2>Account setup</h2><span>{Number(profile.patUploaded) + Number(Boolean(profile.bankUpdatedAt))} of 2 complete</span></div><div className="scouter-setup-list">
        <button type="button" onClick={() => navigate("pat")}><LockKeyhole size={20} aria-hidden="true" /><span><strong>GitHub PAT</strong><small>{profile.patUploaded ? `Updated ${formatDate(profile.patUpdatedAt)}` : "Upload your personal access token"}</small></span><span className={`badge ${profile.patUploaded ? "green" : "amber"}`}>{profile.patUploaded ? "Uploaded" : "Required"}</span><ArrowUpRight size={16} /></button>
        <button type="button" onClick={() => navigate("earnings")}><Landmark size={20} aria-hidden="true" /><span><strong>Bank details</strong><small>{profile.bankName || "Add your payout account"}</small></span><span className={`badge ${profile.bankUpdatedAt ? "green" : "amber"}`}>{profile.bankUpdatedAt ? "Added" : "Required"}</span><ArrowUpRight size={16} /></button>
      </div></section>
      <section className="scouter-band"><div className="scouter-band-heading"><h2>Recent earnings</h2><button type="button" className="button button-white" onClick={() => navigate("earnings")}>View earnings <ArrowUpRight size={14} /></button></div>{proofs.length ? <ul className="scouter-proof-list">{proofs.slice(0, 5).map((item) => <li key={item.id}><a href={item.transaction_hash ? `https://stellar.expert/explorer/public/tx/${item.transaction_hash}` : `/api/scouters/${encodeURIComponent(login)}/proofs/${item.id}`} target="_blank" rel="noreferrer">{item.amount_stroops ? formatUsd(item.amount_stroops) : item.filename}<ArrowUpRight size={13} /></a><span className={`badge ${item.status === "confirmed" ? "green" : item.status === "rejected" ? "red" : "amber"}`}>{item.status}</span><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></li>)}</ul> : <p className="scouter-empty-line">No earnings submitted yet.</p>}</section>
    </>}

    {view === "work" && <>
    <div className="scouter-work-toolbar"><div className="scouter-work-search"><Search size={16} aria-hidden="true" /><Input type="search" aria-label="Search your work" placeholder="Search issues and pull requests" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Select value={workStatus} onValueChange={setWorkStatus}><SelectTrigger className="scouter-work-status" aria-label="Work status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="merged">Merged</SelectItem></SelectContent></Select></div>
    <section className="scouter-band" aria-labelledby="work-heading"><div className="scouter-band-heading"><h2 id="work-heading">Your work</h2><span>{issues.length + prs.length} matching items</span></div>
      <div className="mb-3 flex gap-1 rounded-md border border-zinc-200 bg-zinc-100 p-1 dark:border-[#37313b] dark:bg-[#1e1b21]" role="tablist" aria-label="Work type">{([[
        "issues", "Assigned issues", issues.length, CircleDot,
      ], ["pull-requests", "Pull requests", prs.length, GitPullRequest]] as const).map(([id, label, count, Icon]) => <button key={id} id={`scouter-work-tab-${id}`} type="button" role="tab" aria-selected={workTab === id} aria-controls="scouter-work-panel" tabIndex={workTab === id ? 0 : -1} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-sm border-0 px-2 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 sm:px-3 dark:text-[#aaa3ae] dark:hover:text-[#ede9ef] ${workTab === id ? "bg-white text-zinc-900 shadow-sm dark:bg-[#342a39] dark:text-[#ede9ef]" : "bg-transparent"}`} onClick={() => setWorkTab(id)} onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const next = id === "issues" ? "pull-requests" : "issues"; setWorkTab(next); document.getElementById(`scouter-work-tab-${next}`)?.focus(); }}><Icon size={15} aria-hidden="true" /><span>{label}</span><strong className="min-w-5 rounded-sm bg-zinc-200 px-1 py-0.5 text-center text-[10px] dark:bg-[#29242d]">{count}</strong></button>)}</div>
      <div id="scouter-work-panel" className="overflow-x-auto rounded-md border border-zinc-200 bg-white dark:border-[#37313b] dark:bg-[#1b181d]" role="tabpanel" tabIndex={0} aria-labelledby={`scouter-work-tab-${workTab}`}>
        {workTab === "issues" ? issues.length ? <table className="w-full table-fixed border-collapse text-left"><thead><tr><th className="border-b border-zinc-200 bg-zinc-50 px-2.5 py-2.5 text-[11px] font-medium text-zinc-500 sm:px-3.5 dark:border-[#37313b] dark:bg-[#211e24] dark:text-[#aaa3ae]" scope="col">Assigned issue</th><th className="w-[84px] border-b border-zinc-200 bg-zinc-50 px-2.5 py-2.5 text-[11px] font-medium text-zinc-500 sm:w-[110px] sm:px-3.5 dark:border-[#37313b] dark:bg-[#211e24] dark:text-[#aaa3ae]" scope="col">Status</th></tr></thead><tbody>{issues.map((issue) => <tr className="last:[&_td]:border-b-0 hover:bg-zinc-50 dark:hover:bg-[#211d23]" key={issue.id}><td className="border-b border-zinc-200 px-2.5 py-3 text-[13px] align-middle sm:px-3.5 dark:border-[#37313b]"><a className="inline-flex max-w-full flex-wrap items-start gap-x-1.5 gap-y-0.5 font-semibold leading-snug break-words hover:text-[#80628d] dark:hover:text-[#c8add2] dark:focus-visible:text-[#c8add2] sm:items-center sm:flex-nowrap" href={issue.url || "#"} target="_blank" rel="noreferrer"><span className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-[#aaa3ae]">#{issue.github_issue_number}</span>{issue.title}<ArrowUpRight size={13} aria-hidden="true" /></a></td><td className="border-b border-zinc-200 px-2.5 py-3 text-[13px] align-middle sm:px-3.5 dark:border-[#37313b]"><span className={`badge ${issue.state === "closed" ? "purple" : "green"}`}>{issue.state}</span></td></tr>)}</tbody></table> : <p className="px-4 py-8 text-center text-[13px] text-zinc-500 dark:text-[#aaa3ae]">No assigned issues match these filters.</p> : prs.length ? <table className="w-full table-fixed border-collapse text-left"><thead><tr><th className="border-b border-zinc-200 bg-zinc-50 px-2.5 py-2.5 text-[11px] font-medium text-zinc-500 sm:px-3.5 dark:border-[#37313b] dark:bg-[#211e24] dark:text-[#aaa3ae]" scope="col">Pull request</th><th className="w-[84px] border-b border-zinc-200 bg-zinc-50 px-2.5 py-2.5 text-[11px] font-medium text-zinc-500 sm:w-[110px] sm:px-3.5 dark:border-[#37313b] dark:bg-[#211e24] dark:text-[#aaa3ae]" scope="col">Status</th></tr></thead><tbody>{prs.map((pr) => <tr className="last:[&_td]:border-b-0 hover:bg-zinc-50 dark:hover:bg-[#211d23]" key={pr.id}><td className="border-b border-zinc-200 px-2.5 py-3 text-[13px] align-middle sm:px-3.5 dark:border-[#37313b]"><a className="inline-flex max-w-full flex-wrap items-start gap-x-1.5 gap-y-0.5 font-semibold leading-snug break-words hover:text-[#80628d] dark:hover:text-[#c8add2] dark:focus-visible:text-[#c8add2] sm:items-center sm:flex-nowrap" href={pr.url || "#"} target="_blank" rel="noreferrer"><span className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-[#aaa3ae]">#{pr.github_pull_request_number}</span>{pr.title}<ArrowUpRight size={13} aria-hidden="true" /></a></td><td className="border-b border-zinc-200 px-2.5 py-3 text-[13px] align-middle sm:px-3.5 dark:border-[#37313b]"><span className={`badge ${pr.merged ? "purple" : pr.state === "open" ? "green" : "neutral"}`}>{pr.merged ? "Merged" : pr.state}</span></td></tr>)}</tbody></table> : <p className="px-4 py-8 text-center text-[13px] text-zinc-500 dark:text-[#aaa3ae]">No pull requests match these filters.</p>}
      </div>
    </section>
    </>}

    {view === "pat" &&
    <section className="scouter-band" aria-labelledby="pat-heading"><div className="scouter-band-heading"><h2 id="pat-heading"><LockKeyhole size={18} /> GitHub PAT</h2><span>{profile.patUploaded ? `Uploaded ${formatDate(profile.patUpdatedAt)}` : "Not uploaded"}</span></div>
      {profile.patUploaded && !editingPat ? <div className="scouter-saved-pat"><span><Check size={18} aria-hidden="true" /> Personal access token added</span><button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { patForm.reset(); setEditingPat(true); setError(""); setMessage(""); }}><Pencil size={15} aria-hidden="true" /> Update PAT</button></div> :
      <form className="scouter-form" onSubmit={patForm.handleSubmit((values) => { setError(""); setMessage(""); profileMutation.mutate(values); })}><label htmlFor="scouter-pat">Personal access token</label><Input id="scouter-pat" type="password" autoComplete="off" autoFocus={editingPat} disabled={Boolean(busy)} aria-describedby="pat-consent pat-error" placeholder={profile.patUploaded ? "Replace existing PAT" : "github_pat_..."} {...patForm.register("pat")} />
        {patForm.formState.errors.pat && <p id="pat-error" className="scouter-field-error" role="alert">{patForm.formState.errors.pat.message}</p>}
        <p id="pat-consent" className="scouter-consent">Your GitHub Personal Access Token will be visible to authorized admins so they can authenticate the CLI and push fixes for issues assigned to you.</p>
        <div className="scouter-form-actions"><button type="submit" className="button button-black" disabled={Boolean(busy)}>{busy === "pat" ? "Saving PAT..." : profile.patUploaded ? "Update PAT" : "Upload PAT"}</button>{profile.patUploaded && <button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { patForm.reset(); setEditingPat(false); setError(""); }}>Cancel</button>}</div></form>}
    </section>}

    {view === "earnings" && <>
    <div className="earnings-summary scouter-earnings-summary" aria-label="Your earnings totals">
      <article className="earnings-summary-card"><span><span>Confirmed gross</span><BadgeDollarSign size={18} aria-hidden="true" /></span><strong>{formatUsd(confirmedGross)}</strong><small>{formatNaira(confirmedGross)} total received</small></article>
      <article className="earnings-summary-card green"><span><span>Your 60%</span><WalletCards size={18} aria-hidden="true" /></span><strong>{formatUsd(confirmedShare)}</strong><small>{formatNaira(confirmedShare)} at {"\u20a6"}1,400/$</small></article>
      <article className="earnings-summary-card green"><span><span>Paid to you</span><Check size={18} aria-hidden="true" /></span><strong>{formatUsd(paidShare)}</strong><small>{formatNaira(paidShare)}</small></article>
      <article className="earnings-summary-card amber"><span><span>Awaiting payout</span><RefreshCw size={18} aria-hidden="true" /></span><strong>{formatUsd(outstandingShare)}</strong><small>{formatNaira(outstandingShare)}</small></article>
    </div>
    <section className="scouter-band" aria-labelledby="destination-heading"><div className="scouter-band-heading"><h2 id="destination-heading">Drip Wave withdrawal</h2><span>Stellar public key</span></div>
      <p className="scouter-destination-copy">On Drip Wave, withdraw to this public key. No memo is required.</p>
      <div className="scouter-address"><code>{WITHDRAWAL_ADDRESS}</code><button type="button" className="button button-white" onClick={copyAddress} aria-label="Copy Drip Wave withdrawal public key" title="Copy public key">{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}</button></div>
    </section>

    <section className="scouter-band" aria-labelledby="bank-heading"><div className="scouter-band-heading"><h2 id="bank-heading"><Landmark size={18} /> Bank withdrawal details</h2><span>{profile.bankUpdatedAt ? `Updated ${formatDate(profile.bankUpdatedAt)}` : "Not added"}</span></div>
      {profile.bankUpdatedAt && !editingBank ? <div className="scouter-saved-bank"><dl><div><dt>Bank name</dt><dd>{profile.bankName}</dd></div><div><dt>Name on account</dt><dd>{profile.bankAccountName}</dd></div><div><dt>Account number</dt><dd>{profile.bankAccountNumber}</dd></div></dl><button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { bankForm.reset({ kind: "bank", bankName: profile.bankName, accountName: profile.bankAccountName, accountNumber: profile.bankAccountNumber }); setEditingBank(true); setError(""); setMessage(""); }}><Pencil size={15} aria-hidden="true" /> Edit bank details</button></div> :
      <form className="scouter-form scouter-bank-form" onSubmit={bankForm.handleSubmit((values) => { setError(""); setMessage(""); profileMutation.mutate(values); })}><label>Bank name<Input autoFocus={editingBank} disabled={Boolean(busy)} aria-invalid={Boolean(bankForm.formState.errors.bankName)} aria-describedby={bankForm.formState.errors.bankName ? "bank-name-error" : undefined} {...bankForm.register("bankName")} />{bankForm.formState.errors.bankName && <span id="bank-name-error" className="scouter-field-error" role="alert">{bankForm.formState.errors.bankName.message}</span>}</label><label>Name on account<Input disabled={Boolean(busy)} aria-invalid={Boolean(bankForm.formState.errors.accountName)} aria-describedby={bankForm.formState.errors.accountName ? "account-name-error" : undefined} {...bankForm.register("accountName")} />{bankForm.formState.errors.accountName && <span id="account-name-error" className="scouter-field-error" role="alert">{bankForm.formState.errors.accountName.message}</span>}</label><label>Account number<Input disabled={Boolean(busy)} inputMode="numeric" aria-invalid={Boolean(bankForm.formState.errors.accountNumber)} aria-describedby={bankForm.formState.errors.accountNumber ? "account-number-error" : undefined} {...bankForm.register("accountNumber")} />{bankForm.formState.errors.accountNumber && <span id="account-number-error" className="scouter-field-error" role="alert">{bankForm.formState.errors.accountNumber.message}</span>}</label><div className="scouter-form-actions"><button type="submit" className="button button-black" disabled={Boolean(busy)}>{busy === "bank" ? "Saving bank details..." : "Save bank details"}</button>{profile.bankUpdatedAt && <button type="button" className="button button-white" disabled={Boolean(busy)} onClick={() => { bankForm.reset({ kind: "bank", bankName: profile.bankName, accountName: profile.bankAccountName, accountNumber: profile.bankAccountNumber }); setEditingBank(false); setError(""); }}>Cancel</button>}</div></form>}
    </section>

    <section className="scouter-band" aria-labelledby="proof-heading"><div className="scouter-band-heading"><h2 id="proof-heading"><Upload size={18} /> Submit an earning</h2><span>{proofs.length} submitted</span></div>
      <form className="scouter-form scouter-proof-form" onSubmit={proofForm.handleSubmit((values) => { const file = values.proof.item(0); if (file) { setError(""); setMessage(""); proofMutation.mutate({ file, transaction: values.transaction }); } })} aria-busy={busy === "proof"}>
        <label htmlFor="scouter-transaction">Stellar transaction URL or hash</label><Input id="scouter-transaction" placeholder="https://stellar.expert/explorer/public/tx/..." disabled={Boolean(busy)} aria-invalid={Boolean(proofForm.formState.errors.transaction)} aria-describedby={`scouter-transaction-help${proofForm.formState.errors.transaction ? " scouter-transaction-error" : ""}`} {...proofForm.register("transaction")} /><p id="scouter-transaction-help" className="scouter-consent">We verify the amount, USDC issuer, and Plinger destination directly on Stellar.</p>{proofForm.formState.errors.transaction && <p id="scouter-transaction-error" className="scouter-field-error" role="alert">{proofForm.formState.errors.transaction.message}</p>}
        <label htmlFor="scouter-proof">Drip Wave withdrawal confirmation</label><input id="scouter-proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required disabled={Boolean(busy)} aria-invalid={Boolean(proofForm.formState.errors.proof)} aria-describedby={proofForm.formState.errors.proof ? "scouter-proof-error" : undefined} {...proofForm.register("proof")} />{proofForm.formState.errors.proof && <p id="scouter-proof-error" className="scouter-field-error" role="alert">{proofForm.formState.errors.proof.message}</p>}<button type="submit" className="button button-black" disabled={!proofForm.formState.isValid || Boolean(busy)}>{busy === "proof" ? "Verifying transaction..." : "Verify and submit earning"}</button>
      </form>
      {proofs.length > 0 && <div className="scouter-earning-list">{proofs.map((item) => { const share = splitEarnings(item.amount_stroops ?? "0").scouter; return <article key={item.id}><div><strong>{item.amount_stroops ? formatUsd(item.amount_stroops) : "Legacy proof"}</strong><span>{item.transaction_created_at ? formatDate(item.transaction_created_at) : formatDate(item.created_at)}</span></div><div><strong>{item.amount_stroops ? formatUsd(share) : "\u2014"}</strong><span>Your 60% \u00b7 {item.amount_stroops ? formatNaira(share) : "Not calculated"}</span></div><div><span className={`badge ${item.status === "confirmed" ? "green" : item.status === "rejected" ? "red" : "amber"}`}>{item.status}</span>{item.status === "confirmed" && <span className={`badge ${item.payout_status === "paid" ? "green" : "neutral"}`}>{item.payout_status === "paid" ? "Paid" : "Payout due"}</span>}</div><div>{item.transaction_hash && <a href={`https://stellar.expert/explorer/public/tx/${item.transaction_hash}`} target="_blank" rel="noreferrer">Transaction <ArrowUpRight size={13} aria-hidden="true" /></a>}<a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${item.id}`} target="_blank" rel="noreferrer">Proof <ArrowUpRight size={13} aria-hidden="true" /></a></div></article>; })}</div>}
    </section>
    </>}
  </ScouterWorkspace>;
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
