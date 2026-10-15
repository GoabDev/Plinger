import { SupportLinks } from "../../../ui/support-links";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, KeyRound } from "lucide-react";
import styles from "../../docs.module.css";

const tokenGuide = "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens";
const description = "Create a GitHub personal access token for Plinger, choose the scopes for developer and agent work, and copy it for your next setup step.";

export const metadata: Metadata = {
  title: "Create your GitHub PAT — Scouter guide", description,
  alternates: { canonical: "/docs/getting-started/github-pat" },
  openGraph: { title: "Create your GitHub PAT — Plinger guide", description, url: "/docs/getting-started/github-pat" },
  twitter: { title: "Create your GitHub PAT — Plinger guide", description },
};

export default function GitHubPatPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Getting started <span>/</span> <span>GitHub PAT</span></div>
        <div className={styles.titleIcon}><KeyRound size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>CONNECT YOUR WORK</p>
        <h1>Create your GitHub PAT</h1>
        <p className={styles.lead}>Give Plinger access to track your issues and support approved developer and agent work.</p>
        <section id="what-is-a-pat" className={styles.section}>
          <h2>What is a PAT?</h2>
          <p>A Personal Access Token is a secret credential that tools can use to access GitHub as you. Plinger uses yours to find assigned issues, pull requests, and their connections. Authorized Plinger admins can retrieve it for approved work by developers and agents.</p>
          <p>This guide uses a classic token for the GitHub CLI workflow across repositories. GitHub generally recommends fine-grained tokens, but documents limitations for contributions across organizations and public repositories you don’t own. <a href={tokenGuide}>Compare token types.</a></p>
        </section>
        <section id="create-the-token" className={styles.section}>
          <h2>Generate your token</h2>
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}>1</span><div><h3>Open token settings</h3><p>Sign in to your scouter GitHub account. Go to Settings → Developer settings → Personal access tokens → Tokens (classic).</p></div></li>
            <li><span className={styles.stepIcon}>2</span><div><h3>Choose a classic token</h3><p>Select Generate new token → Generate new token (classic). Complete any authentication prompt.</p></div></li>
            <li><span className={styles.stepIcon}>3</span><div><h3>Name it and set expiration</h3><p>Enter any Note you like, such as “Plinger”. For this setup, choose No expiration. This means no scheduled expiry; GitHub recommends expiring tokens, and organization policies may require one.</p></div></li>
            <li><span className={styles.stepIcon}>4</span><div><h3>Select your scopes</h3><p>Use the checklist below, then select Generate token.</p></div></li>
            <li><span className={styles.stepIcon}>5</span><div><h3>Copy the PAT immediately</h3><p>Copy the complete token and keep it securely for the next step. You won’t be able to reveal that same value again after leaving the page.</p></div></li>
          </ol>
          <p className={styles.caption}>Based on <a href={tokenGuide}>GitHub’s token-creation guide</a>. Checked 14 October 2026.</p>
          <a className={styles.resource} href="https://github.com/settings/tokens" target="_blank" rel="noreferrer"><span><strong>Open GitHub token settings</strong><small>Opens in a new tab so you can follow this guide</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
        </section>
        <section id="choose-scopes" className={styles.section}>
          <h2>Which scopes should you select?</h2>
          <p>For the classic-token GitHub CLI setup, select <strong>repo</strong>, <strong>read:org</strong>, and <strong>gist</strong>. These are the minimum scopes documented for <a href="https://cli.github.com/manual/gh_auth_login">GitHub CLI’s token login</a>; they aren’t all needed just to display public issues in Plinger.</p>
          <div className={styles.scopeList}>
            <article><h3><code>repo</code><span>SELECT</span></h3><p>Repository access for work such as pushing code and managing pull requests. This is broad: it covers public and private repositories your account can access.</p></article>
            <article><h3><code>read:org</code><span>SELECT</span></h3><p>Read organization and team membership. Find read:org under admin:org and tick only read:org, leaving admin:org and write:org unchecked.</p></article>
            <article><h3><code>gist</code><span>SELECT</span></h3><p>Allows writing GitHub gists, which are shared snippets. Included here for GitHub CLI token-login compatibility.</p></article>
            <article><h3><code>workflow</code><span>SELECT</span></h3><p>Add this when the developer or agent needs to create or update GitHub Actions workflow files, such as automated tests in .github/workflows.</p></article>
          </div>
          <p className={styles.caption}>Leave other scopes unchecked unless a specific task requires them. Broad admin scopes and delete_repo aren’t needed for routine issue and pull-request work. <a href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps">GitHub’s scope reference.</a></p>
        </section>
        <section id="watch-the-guide" className={styles.section}>
          <h2>Watch the walkthrough</h2>
          <p>Follow the video here. Use the scope checklist above for Plinger’s setup if the video selects different permissions.</p>
          <iframe className={styles.video} src="https://www.youtube-nocookie.com/embed/J-CSiw5CFWE" title="How to create a GitHub Personal Access Token" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          <p className={styles.caption}>If the embedded player is unavailable, <a href="https://www.youtube.com/watch?v=J-CSiw5CFWE" target="_blank" rel="noreferrer">open the video on YouTube (new tab)</a>.</p>
        </section>
        <aside className={styles.note}><strong>Keep your copied PAT ready for the next step</strong><p>You’ll enter it in Plinger’s GitHub PAT section. Treat it like a password: don’t post it in issues, public chats, screenshots, or source code. If you lose it before saving, generate a replacement; if it is exposed, revoke it and replace it in Plinger.</p></aside>
        <section id="next-step" className={styles.section}>
          <h2>Ready to continue?</h2>
          <p>Make sure the token belongs to the same GitHub account you use to sign in to Plinger. Keep the complete value copied, then open your dashboard and choose GitHub PAT to save it.</p>
          <Link className={styles.resource} href="/docs/getting-started/plinger-account"><span><small>Next</small><strong>Create your Plinger account</strong><small>Install the App, sign in, and save your details</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        </section>
        <Link className={styles.resource} href="/docs/getting-started/drips-wave-account"><span><small>Previous</small><strong>Create a Drips Wave account</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide<SupportLinks /></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#what-is-a-pat">What is a PAT?</a><a href="#create-the-token">Generate your token</a><a href="#choose-scopes">Choose scopes</a><a href="#watch-the-guide">Watch the walkthrough</a><a href="#next-step">Ready to continue?</a></nav>
    </>
  );
}
