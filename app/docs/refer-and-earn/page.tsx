import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Users } from "lucide-react";
import styles from "../docs.module.css";
import actionStyles from "./whatsapp-links.module.css";

const contact = "https://wa.me/2348146821934";
const group = "https://chat.whatsapp.com/Bq0I6aZSDhy010KxZ36rzf?mode=gi_t";
const description = "Learn how a qualifying referral increases your share of your Wave earnings from 60% to 70%, and how to register a referral with the Plinger team.";

export const metadata: Metadata = {
  title: "Refer and earn — Scouter guide",
  description,
  alternates: { canonical: "/docs/refer-and-earn" },
  openGraph: { title: "Refer and earn — Plinger guide", description, url: "/docs/refer-and-earn" },
};

export default function ReferAndEarnPage() {
  return <>
    <main id="docs-content" className={styles.article} tabIndex={-1}>
      <div className={styles.breadcrumb}>Earnings <span>/</span> <span>Refer and earn</span></div>
      <div className={styles.titleIcon}><Users size={26} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>BRING AN ACTIVE SCOUTER</p>
      <h1>Refer and earn</h1>
      <p className={styles.lead}>Refer someone who takes part and earns in a Wave, and your share of your own earnings for that Wave increases from 60% to 70%.</p>
      <p>Plinger helps scouters and developers work together on real issues. Referrals are an optional way to earn back part of the usual 40% share retained by Plinger. The reward depends on actual participation and earnings, not simply inviting people.</p>

      <section id="how-it-works" className={styles.section}>
        <h2>How the reward works</h2>
        <p>A qualifying referral gives you an extra <strong>10 percentage points of your own earnings for that Wave</strong>. Your share becomes 70% instead of the usual 60%.</p>
        <aside className={styles.note}><strong>An example</strong><p>If your earnings for the Wave are $100, your usual share is $60. With a qualifying referral, your share is $70: an extra $10 from your own Wave earnings.</p></aside>
        <p>The person you refer must be <strong>active in that Wave and actually earn</strong> before you qualify. Signing up or joining the group alone is not enough.</p>
        <p>This reward applies to the qualifying Wave. It is not a permanent change to your earnings share.</p>
      </section>

      <section id="refer-someone" className={styles.section}>
        <h2>How to refer someone now</h2>
        <p>For now, referrals are handled directly with the Plinger team on WhatsApp.</p>
        <ul className={`${styles.steps} ${actionStyles.referralSteps}`}>
          <li><span className={styles.stepIcon}>1</span><div><h3>Send their GitHub username</h3><p>Send a direct message to <a className={actionStyles.inlineLink} href={contact} target="_blank" rel="noreferrer" aria-label="Message the Plinger team on WhatsApp at +234 814 682 1934 (opens a new tab)" title="+234 814 682 1934"><WhatsAppIcon /><span>Plinger on WhatsApp</span><ArrowUpRight size={13} aria-hidden="true" /></a> with the GitHub username of the person you referred. Let the team know they are your referral.</p></div></li>
          <li><span className={styles.stepIcon}>2</span><div><h3>Help them join the Plinger group</h3><p>Share the <a className={actionStyles.inlineLink} href={group} target="_blank" rel="noreferrer" aria-label="Open the Plinger WhatsApp group invitation (opens a new tab)"><WhatsAppIcon /><span>Plinger group invitation</span><ArrowUpRight size={13} aria-hidden="true" /></a> with them and make sure they join. You can also send them the <Link href="/docs/getting-started/github-account">getting-started guide</Link> to help them set up.</p></div></li>
          <li><span className={styles.stepIcon}>3</span><div><h3>They participate and earn</h3><p>Your referral needs to be active and earn in the Wave before your extra 10 percentage points apply. If you need to check whether your referral qualifies, message the team.</p></div></li>
        </ul>
        <a className={styles.resource} href={contact} target="_blank" rel="noreferrer"><span><strong>Register a referral on WhatsApp</strong><small>Send the person?s GitHub username ? Opens a new tab</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
        <a className={styles.resource} href={group} target="_blank" rel="noreferrer"><span><strong>Plinger WhatsApp group</strong><small>Share this invitation with the person you referred ? Opens a new tab</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
      </section>

      <section id="coming-to-plinger" className={styles.section}>
        <h2>Coming to Plinger</h2>
        <p>We’re working on bringing Refer and earn directly into Plinger to make the process easier. The built-in feature is not available yet. Use the WhatsApp steps above for now; we’ll let you know when the feature has been added.</p>
      </section>
      <Link className={styles.resource} href="/docs/withdrawals"><span><small>Previous</small><strong>Withdraw your rewards</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
      <footer className={styles.footer}>Plinger guide <span>Referrals are currently handled on WhatsApp.</span></footer>
    </main>
    <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#how-it-works">How the reward works</a><a href="#refer-someone">Refer someone now</a><a href="#coming-to-plinger">Coming to Plinger</a></nav>
  </>;
}

function WhatsAppIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.1Z" /><path d="m8.3 7.4 1.5 2.4-1 1.1a8.6 8.6 0 0 0 4.3 4.3l1.1-1 2.4 1.5c-.2 1.3-1.3 2-2.5 1.6-3.8-1.2-6.7-4.1-7.9-7.9-.4-1.2.3-2.3 1.6-2.5Z" /></svg>;
}
