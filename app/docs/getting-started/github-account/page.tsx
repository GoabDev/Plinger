import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, UserPlus } from "lucide-react";
import styles from "../../docs.module.css";

const description = "Create your free GitHub account with simple signup steps, email verification help, and a video walkthrough for scouters.";
const accountGuide = "https://docs.github.com/en/account-and-profile/how-tos/account-management/creating-an-account-on-github";
const emailGuide = "https://docs.github.com/en/account-and-profile/how-tos/email-preferences/verifying-your-email-address";

export const metadata: Metadata = {
  title: "Create a GitHub account — Scouter guide",
  description,
  alternates: { canonical: "/docs/getting-started/github-account" },
  openGraph: { title: "Create a GitHub account — Plinger guide", description, url: "/docs/getting-started/github-account" },
  twitter: { title: "Create a GitHub account — Plinger guide", description },
};

export default function GitHubAccountPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Getting started <span>/</span> <span>GitHub account</span></div>
        <div className={styles.titleIcon}><UserPlus size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>YOUR FIRST STEP</p>
        <h1>Create a GitHub account</h1>
        <p className={styles.lead}>Your GitHub account is how you sign in to Plinger and keep your work connected to you.</p>
        <section id="before-you-start" className={styles.section}>
          <h2>Before you start</h2>
          <p>Have an email address you can open and a username in mind. You can create a free personal account in your browser, on a phone or computer. Already have one? Sign in to that account and check that your email is verified.</p>
        </section>
        <section id="create-your-account" className={styles.section}>
          <h2>Create your account</h2>
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}>1</span><div><h3>Open GitHub’s signup page</h3><p>Go to <a href="https://github.com/signup" target="_blank" rel="noreferrer">github.com/signup (opens in a new tab)</a>, so you can keep this guide beside you.</p></div></li>
            <li><span className={styles.stepIcon}>2</span><div><h3>Choose how to sign up</h3><p>Use your email address, or choose Continue with Google or Continue with Apple and follow the prompts.</p></div></li>
            <li><span className={styles.stepIcon}>3</span><div><h3>Fill in your details</h3><p>For email signup, enter your email, a unique password, an available username, and your country or region. Follow the password requirements shown on the form. Your username identifies you on GitHub.</p></div></li>
            <li><span className={styles.stepIcon}>4</span><div><h3>Finish the account checks</h3><p>Complete any verification challenge GitHub displays, then select Create account and follow the remaining prompts.</p></div></li>
            <li><span className={styles.stepIcon}>5</span><div><h3>Verify your email</h3><p>Open the message from GitHub and follow its verification instructions. Return to GitHub to finish signing in.</p></div></li>
          </ol>
          <p className={styles.caption}>Based on <a href={accountGuide}>GitHub’s account-creation guide</a> and the <a href="https://github.com/signup">current signup form</a>. Checked 14 October 2026.</p>
        </section>
        <section id="watch-the-walkthrough" className={styles.section}>
          <h2>Watch the walkthrough</h2>
          <p>Prefer to follow along? Play this video here, and pause whenever you need to complete a step.</p>
          <iframe
            className={styles.video}
            src="https://www.youtube-nocookie.com/embed/bAidITtKnU4"
            title="How to Create GitHub Account in 2026 — Operatify"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <p className={styles.caption}>How to Create GitHub Account in 2026 · Operatify. GitHub’s screens may change; use the written steps above if the video looks different. If the player is unavailable, <a href="https://www.youtube.com/watch?v=bAidITtKnU4" target="_blank" rel="noreferrer">open the video on YouTube (new tab)</a>.</p>
        </section>
        <section id="email-help" className={styles.section}>
          <h2>Can’t find the verification email?</h2>
          <p>Check your spam or junk folder. To request another email, open your GitHub profile menu, choose Settings, then Emails, and select Resend verification email. Follow the link in the new message.</p>
          <p className={styles.caption}>See <a href={emailGuide}>GitHub’s email-verification guide</a> for more help.</p>
        </section>
        <aside className={styles.note}><strong>Keep your account secure</strong><p>GitHub recommends enabling two-factor authentication: an extra check when you sign in. Follow <a href="https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication">GitHub’s setup guide</a> and keep your recovery codes somewhere safe.</p></aside>
        <section id="youre-ready" className={styles.section}>
          <h2>You’re ready when…</h2>
          <p>You can sign in to GitHub, your email is verified, and you know your username. Use this same account when signing in to Plinger.</p>
          <Link href="/scouter/login" className={styles.resource}><span><strong>Continue to Plinger</strong><small>Sign in with your GitHub account</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        </section>
        <Link className={styles.resource} href="/docs/plinger"><span><small>Previous</small><strong>What is Plinger?</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
        <Link className={styles.resource} href="/docs/getting-started/drips-wave-account"><span><small>Next</small><strong>Create a Drips Wave account</strong></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide <span>Made for scouters, one step at a time.</span></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#before-you-start">Before you start</a><a href="#create-your-account">Create your account</a><a href="#watch-the-walkthrough">Watch the walkthrough</a><a href="#email-help">Email help</a><a href="#youre-ready">You’re ready when…</a></nav>
    </>
  );
}
