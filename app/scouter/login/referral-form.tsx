"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Link2, X } from "lucide-react";
import { checkReferral, signInWithGitHub } from "./actions";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "../../ui/alert-dialog";

function ContinueButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button button-black" disabled={pending || disabled} type="submit">{pending ? "Connecting…" : "Continue with GitHub"}</button>;
}

export default function ReferralLoginForm({ initialRef, preview }: { initialRef: string; preview: { login: string; waveName: string; waveId: string } | null }) {
  const [open, setOpen] = useState(false);
  const [referred, setReferred] = useState(Boolean(initialRef));
  const [link, setLink] = useState(initialRef);
  const [checked, setChecked] = useState(preview);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const hasLink = Boolean(link.trim());

  async function verifyLink() {
    setChecking(true);
    setError("");
    try {
      const result = await checkReferral(link);
      if (result.error || !result.waveId) {
        setError(result.error || "Referral unavailable");
      } else {
        setChecked({ login: result.login!, waveName: result.waveName!, waveId: result.waveId });
      }
    } catch {
      setError("Could not check this referral. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return <>
    <button type="button" className="button button-black login-submit" onClick={() => setOpen(true)}>Continue with GitHub</button>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="referral-signup-dialog">
        <button type="button" className="referral-signup-close" aria-label="Close referral dialog" onClick={() => setOpen(false)}><X size={20} /></button>
        <div className="referral-signup-icon" aria-hidden="true"><Link2 size={22} /></div>
        <AlertDialogHeader>
          <AlertDialogTitle>{referred ? "Add your referral link" : "Were you referred by a Scouter?"}</AlertDialogTitle>
          <AlertDialogDescription>{referred ? "Paste the link your Scouter shared with you. We’ll check it before you sign in." : "Choose yes to add their referral link. Otherwise, continue straight to GitHub."}</AlertDialogDescription>
        </AlertDialogHeader>
        {!referred ? <div className="referral-signup-choices">
          <button type="button" className="button button-white" onClick={() => setReferred(true)}><Link2 size={17} aria-hidden="true" /> Yes, I was referred</button>
          <form action={signInWithGitHub}><ContinueButton disabled={false} /></form>
        </div> : <form action={signInWithGitHub} className="referral-signup-form" onSubmit={(event) => { if (!hasLink || !checked) { event.preventDefault(); if (hasLink && !checking) void verifyLink(); } }}>
          <div className="referral-signup-field">
            <label htmlFor="referral-link">Plinger referral link</label>
            <div className="referral-signup-input-row">
              <input id="referral-link" type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false}
                className="referral-input" name="referral" required disabled={checking} value={link}
                aria-invalid={Boolean(error)} aria-describedby={error ? "referral-error" : "referral-help"}
                onChange={(event) => { setLink(event.target.value); setChecked(null); setError(""); }}
                placeholder="Paste your referral link" maxLength={300} />
              {hasLink && !checked && <button type="button" className="button button-white" disabled={checking} onClick={verifyLink}>{checking ? "Checking…" : "Check link"}</button>}
            </div>
            {error && <p id="referral-error" className="referral-signup-error" role="alert">{error}</p>}
            <p id="referral-help" className="referral-signup-help">Your share stays at 60%. Referrals must be added before your first signup.</p>
          </div>
          {checked && hasLink && <>
            <input type="hidden" name="expectedWave" value={checked.waveId} />
            <div className="referral-signup-verified" role="status"><CheckCircle2 size={19} aria-hidden="true" /><div><strong>Referred by @{checked.login}</strong><span>{checked.waveName} · Link verified</span></div></div>
            <p className="referral-signup-help">Your referrer earns the benefit once an admin verifies your completed work in this wave.</p>
          </>}
          <div className="referral-signup-actions">
            <button type="button" className="button button-white" disabled={checking} onClick={() => { setReferred(false); setError(""); }}>Back</button>
            <ContinueButton disabled={checking || !hasLink || !checked} />
          </div>
        </form>}
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
