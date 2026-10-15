import { SupportLinks } from "../../../ui/support-links";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Network } from "lucide-react";
import styles from "../../docs.module.css";

const description = "Set up your Plinger account: install the GitHub App, sign in with GitHub, save your PAT, and add bank details with step-by-step screenshots.";

export const metadata: Metadata = {
  title: "Create your Plinger account — Scouter guide", description,
  alternates: { canonical: "/docs/getting-started/plinger-account" },
  openGraph: { title: "Create your Plinger account — Scouter guide", description, url: "/docs/getting-started/plinger-account" },
  twitter: { title: "Create your Plinger account — Scouter guide", description },
};

function Screenshot({ file, width, height, alt, caption }: { file: string; width: number; height: number; alt: string; caption: string }) {
  const src = `/docs/plinger-setup/${file}.png`;
  return (
    <figure className={styles.screenshot}>
      <a href={src} target="_blank" rel="noreferrer" aria-label={`${alt}. Open full-size screenshot in a new tab`}>
        <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 700px) 90vw, 708px" />
      </a>
      <figcaption>{caption} Select the image to enlarge it.</figcaption>
    </figure>
  );
}

export default function PlingerAccountPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Getting started <span>/</span> <span>Plinger account</span></div>
        <div className={styles.titleIcon}><Network size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>BRING IT ALL TOGETHER</p>
        <h1>Create your Plinger account</h1>
        <p className={styles.lead}>Connect GitHub, save your PAT, and add your payout details.</p>
        <section id="before-you-start" className={styles.section}>
          <h2>Before you start</h2>
          <p>Have your GitHub login, your <Link href="/docs/getting-started/github-pat">copied PAT</Link>, and your bank details ready. Use the same personal GitHub account throughout these steps. You’ll sign in through GitHub, so you don’t need to create a separate Plinger password.</p>
          <p className={styles.caption}>Screenshots show the current Plinger interface. Dashboard examples use sample data; enter your own details.</p>
        </section>
        <section id="install-plinger" className={styles.section}>
          <h2>1. Install Plinger on GitHub</h2>
          <p>On the Plinger homepage, select <strong>Connect GitHub</strong>, or use the installation link below.</p>
          <Screenshot file="connect-github" width={1200} height={560} alt="Plinger homepage with the Connect GitHub button beside Open your dashboard" caption="Start with Connect GitHub." />
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}>1</span><div><h3>Choose your personal account</h3><p>Sign in to GitHub if asked. If GitHub offers a choice of accounts, select your own username. Plinger identifies scouters through a personal App installation; an organization installation alone won’t connect your scouter account.</p></div></li>
            <li><span className={styles.stepIcon}>2</span><div><h3>Review repository access</h3><p>GitHub may offer All repositories or Only select repositories. Choose the repositories you want the App to access and review the permissions shown.</p></div></li>
            <li><span className={styles.stepIcon}>3</span><div><h3>Finish installing</h3><p>Select Install and complete GitHub’s prompts. Then return to Plinger to sign in.</p></div></li>
          </ol>
          <a className={styles.resource} href="https://github.com/apps/plinger/installations/new" target="_blank" rel="noreferrer"><span><strong>Install the Plinger GitHub App</strong><small>Opens GitHub in a new tab</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
          <p className={styles.caption}>GitHub’s installation screen can vary by account. See <a href="https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party">GitHub’s App installation guide</a>.</p>
        </section>
        <section id="sign-in" className={styles.section}>
          <h2>2. Sign in to Plinger</h2>
          <p>Open <Link href="/scouter/login">Scouter sign-in</Link> and select <strong>Continue with GitHub</strong>. Use the account where you just installed Plinger, review the authorization prompt, and approve it to continue to your workspace.</p>
          <Screenshot file="sign-in" width={440} height={198} alt="Scouter sign-in screen showing Continue with GitHub" caption="Choose Continue with GitHub, rather than Admin sign in." />
          <p>On Overview, look for <strong>Account setup</strong>. Its two items show what you still need to save: your GitHub PAT and bank details.</p>
          <Screenshot file="account-setup" width={908} height={265} alt="Overview Account setup checklist with GitHub PAT and Bank details marked Required" caption="A new account starts with 0 of 2 complete." />
        </section>
        <section id="save-your-pat" className={styles.section}>
          <h2>3. Save your GitHub PAT</h2>
          <p>Select <strong>GitHub PAT</strong> in the sidebar or the Account setup checklist. Paste the complete token you copied in the previous guide into <strong>Personal access token</strong>, then select <strong>Upload PAT</strong>.</p>
          <Screenshot file="upload-pat" width={908} height={298} alt="GitHub PAT form with the Personal access token field and Upload PAT button" caption="The PAT field is empty in this example. Paste your own token here." />
          <p>After saving, you’ll see <strong>Personal access token added</strong>. Plinger queues a sync of your assigned work, so issues may take a little time to appear. You can replace the token later with <strong>Update PAT</strong>.</p>
          <p className={styles.caption}>The token must belong to your signed-in GitHub account. Plinger stores it encrypted, and authorized admins can retrieve it for approved CLI work.</p>
        </section>
        <section id="save-bank-details" className={styles.section}>
          <h2>4. Add your bank details</h2>
          <p>Select <strong>Bank details</strong> in the Overview checklist, or open <strong>Earnings</strong> and find <strong>Bank withdrawal details</strong>. Enter your bank name, the name on your account, and your account number.</p>
          <Screenshot file="bank-details" width={908} height={304} alt="Bank withdrawal details form with Bank name, Name on account, Account number, and Save bank details" caption="Sample data only: Example Bank, Example Scouter, and 0000000000. Replace all three with your own details." />
          <p>Double-check each field, then select <strong>Save bank details</strong>. Wait for the <strong>Bank details saved.</strong> message. Saving records the details you entered; it doesn’t confirm with your bank that they’re correct.</p>
        </section>
        <section id="check-your-setup" className={styles.section}>
          <h2>Check that you’re ready</h2>
          <p>Return to Overview. Account setup should show <strong>2 of 2 complete</strong>, with GitHub PAT marked <strong>Uploaded</strong> and Bank details marked <strong>Added</strong>. You’re ready to use your workspace.</p>
          <div className={styles.helpList}>
            <details><summary>Plinger says I have no personal installation</summary><p>Check <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer">your GitHub installations (new tab)</a>. Make sure Plinger is installed on your personal account, then sign in to Plinger with that same account.</p></details>
            <details><summary>My PAT won’t save or my work is missing</summary><p>Check for missing characters or spaces in your pasted token. If work won’t sync, confirm that the token is still valid, belongs to this account, and has the permissions in the <Link href="/docs/getting-started/github-pat">PAT guide</Link>. An empty work list may also mean nothing has been assigned yet.</p></details>
            <details><summary>My bank details won’t save</summary><p>Fill in all three fields. Enter the account number as digits only, without spaces or dashes, and follow any error shown beneath the form.</p></details>
          </div>
          <Link className={styles.resource} href="/scouter/login"><span><strong>Open your Plinger workspace</strong><small>Continue with your GitHub account</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        </section>
        <Link className={styles.resource} href="/docs/getting-started/github-pat"><span><small>Previous</small><strong>Create your GitHub PAT</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
        <Link className={styles.resource} href="/docs/working-on-issues/applying"><span><small>Next</small><strong>Apply for issues on Drips Wave</strong></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide<SupportLinks /></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#before-you-start">Before you start</a><a href="#install-plinger">1. Install Plinger</a><a href="#sign-in">2. Sign in</a><a href="#save-your-pat">3. Save your PAT</a><a href="#save-bank-details">4. Bank details</a><a href="#check-your-setup">Check your setup</a></nav>
    </>
  );
}
