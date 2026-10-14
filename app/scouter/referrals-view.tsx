"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { getReferrals, referralQueryKey } from "../../lib/referrals/client";

export default function ReferralsView() {
  const query = useQuery({ queryKey: [...referralQueryKey, "self"], queryFn: () => getReferrals() });
  const [selectedWave, setSelectedWave] = useState("");
  const [message, setMessage] = useState("");
  if (query.isPending) return <p role="status">Loading referrals…</p>;
  if (!query.data) return <p role="alert">Referrals are unavailable. <button className="button button-white" onClick={() => query.refetch()}>Retry</button></p>;
  const { waves, referrals, activeWave, link } = query.data;
  const waveId = selectedWave || activeWave?.id || waves.find((w) => w.name === "Wave 10")?.id || waves[0]?.id;
  const wave = waves.find((w) => w.id === waveId);
  const rows = referrals.filter((r) => r.wave_id === waveId);
  const qualified = rows.some((r) => r.status === "qualified");
  return <div className="referral-stack">
    <section className="scouter-band"><div className="scouter-band-heading"><h2>Bring a Scouter. Keep more of your earnings.</h2><span className="badge neutral">{activeWave?.name ?? "Referrals not open"}</span></div>
      <p>Refer a new contributor who completes assigned work. Once an admin verifies their activity, you keep 70% of your own earnings for that wave. Plinger takes 30%. The benefit does not carry into the next wave, and multiple referrals do not stack.</p>
      <label htmlFor="your-referral">Your personal referral link</label><div className="referral-link"><input id="your-referral" className="referral-input" value={link ?? ""} readOnly onFocus={(e) => e.target.select()} /><button type="button" className="button button-black" onClick={async () => { try { await navigator.clipboard.writeText(link!); setMessage("Referral link copied."); } catch { setMessage("Select the link to copy it manually."); } }}><ClipboardCopy size={16} /> Copy</button></div>
      {message && <p role="status">{message}</p>}
      {!activeWave && <p className="scouter-consent">Your link stays the same. New referrals can join once an admin opens the next wave.</p>}
    </section>
    <section className="scouter-band"><div className="scouter-band-heading"><h2>Your referrals</h2><select aria-label="Referral wave" className="referral-input" value={waveId ?? ""} onChange={(e) => setSelectedWave(e.target.value)}>{waves.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.status}</option>)}</select></div>
      <p><strong>{qualified ? "70% to you / 30% to Plinger" : "60% to you / 40% to Plinger"}</strong> for {wave?.name}. {qualified ? "Your benefit covers this entire wave." : "Complete a qualifying referral to unlock your benefit."}</p>
      {wave?.qualification_deadline && <p className="scouter-consent">Review deadline: {new Date(wave.qualification_deadline).toLocaleString(undefined, { timeZone: wave.timezone })} ({wave.timezone}).</p>}
      {rows.length ? <div className="earnings-table-wrap"><table className="earnings-table"><thead><tr><th>Scouter</th><th>Joined</th><th>Activity review</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>@{r.referred_login}</td><td>{new Date(r.joined_at).toLocaleDateString()}</td><td><span className={`badge ${r.status === "qualified" ? "green" : "neutral"}`}>{r.status === "pending" ? "Awaiting activity review" : r.status}</span></td></tr>)}</tbody></table></div> : <p>No referrals recorded for this wave yet.</p>}
    </section>
  </div>;
}
