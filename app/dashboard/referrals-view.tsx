"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, RefreshCw, Search } from "lucide-react";
import { adminEarningsQueryKey } from "../../lib/scouter/admin-client";
import { updateReferral } from "../../lib/referrals/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import styles from "../scouter/referrals.module.css";

type Referral = { referee_id: number; referrer_id: number; source: string; qualified: boolean; referred_at: string };
type ReferralData = { enabled: boolean; scouters?: { account_id: number | null; account_login: string }[]; referrals?: Referral[] };
function dayKey(date: Date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }

export default function ReferralsView() {
  const client = useQueryClient();
  const query = useQuery<ReferralData>({ queryKey: ["admin", "referrals"], queryFn: async () => {
    const response = await fetch("/api/referrals", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load referrals");
    return data;
  } });
  const [referrer, setReferrer] = useState("");
  const [referee, setReferee] = useState("");
  const [date, setDate] = useState(new Date(2026, 9, 15));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [removing, setRemoving] = useState<Referral | null>(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation({ mutationFn: updateReferral, onSuccess: async (_, input) => {
    setMessage("Referral saved.");
    setRemoving(null);
    if ("action" in input && input.action === "assign") { setReferrer(""); setReferee(""); }
    await Promise.all([client.invalidateQueries({ queryKey: ["admin", "referrals"] }), client.invalidateQueries({ queryKey: adminEarningsQueryKey }), client.invalidateQueries({ queryKey: ["scouter"] })]);
  } });
  if (query.isPending) return <p role="status">Loading referrals…</p>;
  if (query.error) return <p role="alert">{query.error.message} <Button className="button button-white" variant="outline" onClick={() => query.refetch()}>Retry</Button></p>;
  if (!query.data.enabled) return <section className={`earnings-panel ${styles.card}`}><h2>Referrals</h2><p>Referral setup is not enabled yet.</p></section>;
  const scouters = query.data.scouters?.filter((s) => s.account_id) ?? [];
  const login = (id: number) => scouters.find((s) => s.account_id === id)?.account_login ?? `GitHub ID ${id}`;
  const referrals = query.data.referrals ?? [];
  const qualified = referrals.filter((r) => r.qualified).length;
  const filtered = referrals.filter((r) => (status === "all" || r.qualified === (status === "qualified")) && `${login(r.referrer_id)} ${login(r.referee_id)}`.toLowerCase().includes(search.toLowerCase()));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <div className={styles.layout}>
    <div className={styles.heading}><span className="badge purple">Wave 10 · October 15–22, 2026 · Lagos time</span><Button className="button button-white" variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={15} /> Refresh</Button></div>
    <div className="earnings-summary"><div className="earnings-summary-card"><span>Total referrals</span><strong>{referrals.length}</strong></div><div className="earnings-summary-card green"><span>Qualified</span><strong>{qualified}</strong></div><div className="earnings-summary-card amber"><span>Awaiting proof</span><strong>{referrals.length - qualified}</strong></div></div>
    {(message || (mutation.error && !removing)) && <p role={mutation.error ? "alert" : "status"}>{mutation.error?.message || message}</p>}
    <div className={styles.adminGrid}>
      <section className={`earnings-panel ${styles.card}`}><h2>Referral activity</h2><p>Who joined, who referred them, and their Wave 10 participation.</p>
        <div className={styles.filters}><div className={styles.search}><Search size={16} aria-hidden="true" /><Input aria-label="Search referrals" placeholder="Search GitHub usernames…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Referral status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="qualified">Qualified</SelectItem><SelectItem value="pending">Awaiting proof</SelectItem></SelectContent></Select></div>
        {filtered.length ? <div className={styles.tableWrap}><table className={`earnings-table ${styles.table}`}><thead><tr><th>Referred scouter</th><th>Referred by</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((r) => <tr key={r.referee_id}><td><strong>{login(r.referee_id)}</strong><small>{new Date(r.referred_at).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" })} · {r.source === "manual" ? "Manual" : "Referral link"}</small></td><td>{login(r.referrer_id)}</td><td><span className={`badge ${r.qualified ? "green" : "amber"}`}>{r.qualified ? "Qualified" : "Awaiting proof"}</span></td><td><Button className="button alert-dialog-danger" variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => { mutation.reset(); setRemoving(r); }}>Remove</Button></td></tr>)}</tbody></table></div> : <div className={styles.empty}><strong>{referrals.length ? "No matching referrals" : "No referrals yet"}</strong><span>{referrals.length ? "Try another username or status." : "Link signups and manual referrals will appear here."}</span></div>}
        <div className={styles.note}><strong>Confirm participation in Earnings</strong><p>Review the completed withdrawal in the audit queue, then use Confirm referral to assign it to Wave 10. One or more qualifying referrals unlock one 10% bonus on the referrer's own Wave 10 earnings. Proof review can happen after October 22.</p></div>
      </section>
      <section className={`earnings-panel ${styles.card}`}><h2>Add a manual referral</h2><p>Record an existing referral. Each referred scouter can have one referrer.</p>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); setMessage(""); mutation.mutate({ action: "assign", referrer: Number(referrer), referee: Number(referee), referredAt: new Date(`${dayKey(date)}T00:00:00+01:00`).toISOString() }); }}>
          <label htmlFor="referrer">Referred by</label><Select required value={referrer} onValueChange={(value) => { setReferrer(value); if (referee === value) setReferee(""); }}><SelectTrigger id="referrer"><SelectValue placeholder="Select referrer" /></SelectTrigger><SelectContent>{scouters.map((s) => <SelectItem key={s.account_id} value={String(s.account_id)}>{s.account_login}</SelectItem>)}</SelectContent></Select>
          <label htmlFor="referee">Referred scouter</label><Select required value={referee} onValueChange={setReferee}><SelectTrigger id="referee"><SelectValue placeholder="Select referred scouter" /></SelectTrigger><SelectContent>{scouters.filter((s) => String(s.account_id) !== referrer).map((s) => <SelectItem key={s.account_id} value={String(s.account_id)}>{s.account_login}</SelectItem>)}</SelectContent></Select>
          <label htmlFor="referral-date">Date referred (Lagos)</label><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button id="referral-date" type="button" variant="outline" className={`button button-white ${styles.dateButton}`}><CalendarIcon size={16} />{date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" required selected={date} onSelect={(value) => { setDate(value); setCalendarOpen(false); }} defaultMonth={new Date(2026, 9, 1)} startMonth={new Date(2026, 9, 1)} endMonth={new Date(2026, 9, 1)} disabled={(day) => dayKey(day) < "2026-10-15" || dayKey(day) > "2026-10-22" || dayKey(day) > today} /></PopoverContent></Popover>
          <Button className="button button-black" type="submit" disabled={!referrer || !referee || mutation.isPending}>{mutation.isPending ? "Saving…" : "Assign referral"}</Button>
        </form>
      </section>
    </div>
    <AlertDialog open={!!removing} onOpenChange={(open) => { if (!open && !mutation.isPending) setRemoving(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this referral?</AlertDialogTitle><AlertDialogDescription>Remove {removing ? login(removing.referee_id) : ""} from this referrer's list. Referrals supporting a recorded bonus cannot be removed.</AlertDialogDescription></AlertDialogHeader>{mutation.error && <p role="alert">{mutation.error.message}</p>}<AlertDialogFooter><AlertDialogCancel className="button button-white" disabled={mutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="button alert-dialog-danger" disabled={mutation.isPending} onClick={(e) => { e.preventDefault(); if (removing) mutation.mutate({ action: "remove", referee: removing.referee_id }); }}>Remove referral</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
