import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Waves } from "lucide-react";
import { WaveVideo } from "./wave-video";
import styles from "../../docs.module.css";

const contributorGuide = "https://docs.drips.network/wave/contributors/solving-issues-and-earning-rewards/";
const support = "https://www.drips.network/wave/support";
const idGuide = "https://support.sumsub.com/identity-verification/requirements-for-identity-document";
const addressGuide = "https://support.sumsub.com/address-verification/requirements-for-address-document";
const description = "Set up Drips Wave with GitHub, prepare for identity verification, troubleshoot common problems, and watch the key steps for scouters.";

export const metadata: Metadata = {
  title: "Create a Drips Wave account — Scouter guide", description,
  alternates: { canonical: "/docs/getting-started/drips-wave-account" },
  openGraph: { title: "Create a Drips Wave account — Plinger guide", description, url: "/docs/getting-started/drips-wave-account" },
  twitter: { title: "Create a Drips Wave account — Plinger guide", description },
};

export default function DripsWaveAccountPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Getting started <span>/</span> <span>Drips Wave account</span></div>
        <div className={styles.titleIcon}><Waves size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>YOUR NEXT STEP</p>
        <h1>Create a Drips Wave account</h1>
        <p className={styles.lead}>Connect your GitHub account, verify your identity, and get ready for your first Wave.</p>
        <section id="sign-in" className={styles.section}>
          <h2>Start with your GitHub account</h2>
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}>1</span><div><h3>Open Drips Wave</h3><p>Visit <a href="https://www.drips.network/wave" target="_blank" rel="noreferrer">Drips Wave (new tab)</a> and select Log in. Use the same personal GitHub account you use for Plinger.</p></div></li>
            <li><span className={styles.stepIcon}>2</span><div><h3>Sign in with GitHub</h3><p>Read the terms and age confirmation, then choose Log in with GitHub. Drips requires you to be at least 18. Follow GitHub’s sign-in and authorization prompts.</p></div></li>
            <li><span className={styles.stepIcon}>3</span><div><h3>Open your verification</h3><p>In Drips Wave, go to Settings → Profile and select the identity-verification prompt. Sumsub, Drips’ verification partner, guides you through the checks.</p></div></li>
          </ol>
          <p className={styles.caption}>Sources: <a href="https://www.drips.network/wave/login">Drips sign-in</a> and the <a href={contributorGuide}>contributor guide</a>. Checked 14 October 2026.</p>
        </section>
        <aside className={styles.note}><strong>Complete verification before applying</strong><p>Identity verification, also called KYC, is required before you can apply for issues or withdraw rewards. Prepare a government-issued ID, a selfie, and proof of address. Follow the requirements shown in your own verification flow.</p></aside>
        <section id="prepare-your-documents" className={styles.section}>
          <h2>Prepare your documents</h2>
          <ul className={styles.steps}>
            <li><span className={styles.stepIcon}>1</span><div><h3>A supported, valid ID</h3><p>Choose a document offered in your verification screen. Common types include passports, national ID cards, and driving licences, but availability depends on the country and Drips’ requirements. Don’t assume a document is accepted if it isn’t listed. <a href="https://support.sumsub.com/identity-verification/acceptable-identity-documents">Check Sumsub’s document guidance.</a></p></div></li>
            <li><span className={styles.stepIcon}>2</span><div><h3>A clear photo of the original</h3><p>Use colour, keep every corner visible, and make sure text and your photo are readable. Include both sides when requested. Avoid glare, blur, screenshots, filters, and edited images. Use a valid, undamaged document and follow the upload format shown on screen. <a href={idGuide}>ID photo requirements.</a></p></div></li>
            <li><span className={styles.stepIcon}>3</span><div><h3>Proof of your home address</h3><p>Prepare a recent bank statement or utility bill showing your full name and address. Check that the name matches your ID and the issuer and issue date are visible. Sumsub’s default guidance asks for a document from the last three months; follow any different requirement displayed by Drips. A bill in someone else’s name may not meet the requirements. <a href={addressGuide}>Address-document requirements.</a></p></div></li>
          </ul>
        </section>
        <section id="complete-verification" className={styles.section}>
          <h2>Complete the checks carefully</h2>
          <p>Use a well-lit space and allow camera access. Keep your face inside the frame, remove hats or glasses that obstruct it, and follow the movements requested on screen. Turn off camera effects and filters. <a href="https://support.sumsub.com/selfie-and-liveness/liveness">Sumsub’s selfie guide</a> explains the check.</p>
          <p>If Drips requests phone verification, follow the SMS-code prompt too. This is an additional check that some users receive, according to the <a href="https://docs.drips.network/wave/contributors/faq/">contributor FAQ</a>.</p>
          <p>After submitting, check your status in Settings → Profile and watch for Drips’ email updates. Approval can take longer when additional review is needed.</p>
        </section>
        <section id="verification-help" className={styles.section}>
          <h2>If verification gets stuck</h2>
          <div className={styles.helpList}>
            <details><summary>The camera won’t open</summary><p>Allow camera access in both your browser and device settings. Close other apps using the camera, update your browser, and check your connection. If needed, try another device. <a href="https://support.sumsub.com/issues-and-troubleshooting/how-to-fix-camera-issues">Camera troubleshooting.</a></p></details>
            <details><summary>My ID photo was rejected</summary><p>Read the stated reason before retrying. Retake blurry or reflective photos with the whole document visible and no fingers covering its details. Don’t edit the image to “fix” it. For expired or unsupported documents, use another accepted ID or ask Drips support what options are available. <a href={idGuide}>ID requirements.</a></p></details>
            <details><summary>My address document was rejected</summary><p>Check the full name, home address, issuer, and date. Submit an original supported document, not a screenshot or a manually edited file. If your bank’s address is out of date, ask the bank to update it and issue a new statement. If you have no suitable document, ask Drips which alternatives it accepts. <a href={addressGuide}>Address requirements.</a></p></details>
            <details><summary>My status says “under review”</summary><p>This can mean a manual check is needed; it isn’t automatically a rejection. There is no guaranteed approval time. For a prolonged delay, contact Drips through its <a href={support}>Support Hub</a>. <a href="https://support.sumsub.com/issues-and-troubleshooting/long-verification">Sumsub explains review delays here.</a></p></details>
            <details><summary>Verification failed, or there is no retry button</summary><p>If Drips marks the failure as retryable, restart from Settings → Profile after correcting the problem. For a permanent rejection, contact Drips support. <a href={`${contributorGuide}#if-verification-doesnt-go-through`}>Drips’ retry guidance.</a></p></details>
          </div>
          <p className={styles.caption}>For KYC questions, Drips recommends its <a href={support}>Support Hub</a> or in-app chat. Include your GitHub username, the exact error, and when it happened. Share screenshots of the error with personal details hidden; keep identity documents out of public chats. <a href="https://www.drips.network/blog/posts/your-guide-to-contributing-well-in-wave">Official support guidance.</a></p>
        </section>
        <aside className={styles.note}><strong>Verify your own account</strong><p>Drips allows one account per participant and requires the person using it to complete their own identity check. Don’t use another person’s ID or create another account to get around a failed check. <a href="https://docs.drips.network/wave/terms-and-rules/">Read the Wave terms.</a></p></aside>
        <section id="watch-the-guide" className={styles.section}>
          <h2>Watch: Drips Wave 101</h2>
          <p>This walkthrough covers the wider Wave process. The three clips below focus on the parts most useful to scouters. Choose a clip to play it here, or watch the full video for the complete picture.</p>
          <WaveVideo />
          <p className={styles.caption}>Drips Wave 101: A Complete Guide for Maintainers &amp; Contributors. Screens and verification requirements may have changed since recording; use the current guidance above. <a href="https://www.youtube.com/watch?v=WxrdiLXWtMM" target="_blank" rel="noreferrer">Open on YouTube if the player is unavailable (new tab).</a></p>
        </section>
        <section id="after-verification" className={styles.section}>
          <h2>Once you’re verified</h2>
          <p>Browse an active Wave’s issues and apply where you can contribute. An application isn’t an assignment: wait for the maintainer’s confirmation. Points follow completed work, not the application itself. <a href={contributorGuide}>Read the contribution steps.</a></p>
          <p>When rewards become available, Drips lists them under Wave → Reward Grants. Its current withdrawal guide describes USDC on Stellar. For Plinger’s workflow, use the withdrawal details shown in your Plinger dashboard and submit the requested proof there. <a href="https://docs.drips.network/wave/withdrawing-rewards/">Read Drips’ current withdrawal guide.</a></p>
        </section>
        <Link className={styles.resource} href="/docs/getting-started/github-account"><span><small>Previous</small><strong>Create a GitHub account</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
        <Link className={styles.resource} href="/docs/getting-started/github-pat"><span><small>Next</small><strong>Create your GitHub PAT</strong></span><ArrowRight size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide <span>Made for scouters, one step at a time.</span></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#sign-in">Sign in with GitHub</a><a href="#prepare-your-documents">Prepare your documents</a><a href="#complete-verification">Complete verification</a><a href="#verification-help">Verification help</a><a href="#watch-the-guide">Watch the guide</a><a href="#after-verification">Once you’re verified</a></nav>
    </>
  );
}
