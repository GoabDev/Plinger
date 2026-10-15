import { SupportLinks } from "../../ui/support-links";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Users } from "lucide-react";
import styles from "../docs.module.css";
import actionStyles from "./whatsapp-links.module.css";

import { PLINGER_WHATSAPP_URL as contact, PLINGER_WHATSAPP_GROUP as group } from "../../../lib/support";
const description = "Learn how a qualifying referral increases your share of your Wave earnings from 60% to 70%, and how to share your Plinger referral link and track qualification.";

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
        <p>Referral links are now available in your Plinger workspace. Start with <Link href="/scouter/referrals">Referrals</Link> in the sidebar or mobile menu.</p>
        <ul className={`${styles.steps} ${actionStyles.referralSteps}`}>
          <li><span className={styles.stepIcon}>1</span><div><h3>Copy your referral link</h3><p>On the Referrals page, select <strong>Copy link</strong>. You can also see your referral code, your current Wave share, and the people you have referred. Share the full link so the person can open it directly.</p></div></li>
          <li><span className={styles.stepIcon}>2</span><div><h3>They sign up through your link</h3><p>Ask a new scouter to open your link <strong>before their first Plinger sign-in</strong>, then continue with their own GitHub account. They should finish signing in in the same browser where they opened the link. An existing Plinger account is not automatically added as a new referral.</p></div></li>
          <li><span className={styles.stepIcon}>3</span><div><h3>Help them get set up</h3><p>Share the <Link href="/docs/getting-started/plinger-account">Plinger account setup guide</Link> so they can install the GitHub App, add their PAT, and save their bank details. Invite them to the <a className={actionStyles.inlineLink} href={group} target="_blank" rel="noreferrer" aria-label="Open the Plinger WhatsApp group invitation (opens a new tab)"><WhatsAppIcon /><span>Plinger group</span><ArrowUpRight size={13} aria-hidden="true" /></a> for support.</p></div></li>
          <li><span className={styles.stepIcon}>4</span><div><h3>They participate, earn, and submit proof</h3><p>They need to take part in the same Wave and earn. Once their Drips withdrawal is completed, they should <Link href="/docs/withdrawals">upload their withdrawal verification to Plinger</Link>. An admin must approve the proof and confirm that the withdrawal belongs to that Wave before the referral qualifies.</p></div></li>
          <li><span className={styles.stepIcon}>5</span><div><h3>Track your referral in Plinger</h3><p>Return to <strong>Referrals: People you referred</strong> to see their GitHub identity, date referred, Wave, and status. A qualifying referral unlocks the extra 10 percentage points on your own confirmed earnings for that Wave.</p></div></li>
        </ul>
        <Link className={styles.resource} href="/scouter/referrals"><span><strong>Open your referrals</strong><small>Copy your link and check your referral history</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
      </section>

      <section id="reward-limits" className={styles.section}>
        <h2>Referral rules and reward limits</h2>
        <p>A new scouter must complete signup through your link during the referral window for that Wave. Opening a link alone does not register a referral.</p>
        <p><strong>One or several qualifying referrals give you the same 10-percentage-point increase.</strong> Your share is capped at 70% for the qualifying Wave. Extra referrals do not stack and are not carried into future Waves.</p>
        <p>The reward is based on your own earnings for that Wave, not the referred person's earnings. If you have no eligible earnings for that Wave, there is no bonus amount to pay. Each referred scouter can have one referrer, and you cannot refer yourself.</p>
        <p>Withdrawal proof can be reviewed after the referral window closes. Your own withdrawal must also be confirmed and assigned to the same Wave for the increased share to appear in your earnings. Withdrawals from other Waves do not qualify for that bonus.</p>
      </section>

      <section id="referral-status" className={styles.section}>
        <h2>Understand your referral status</h2>
          <p><strong>Awaiting proof:</strong> their completed withdrawal has not yet been approved and assigned to the relevant Wave. Signing up, joining the group, or having a pending Drips withdrawal is not enough.</p>
          <p><strong>Qualified:</strong> an admin has confirmed their completed withdrawal for that Wave. This referral counts toward your bonus for the same Wave.</p>
          <p><strong>+10% unlocked:</strong> you have at least one qualifying referral. Check Earnings for the amount due; this status does not mean the money has already been paid.</p>

        <p>If your usual 60% share was already paid before you qualified, the additional 10% can be recorded separately. Check your earnings and contact the team if you need help with the outstanding bonus.</p>
      </section>

      <section id="referral-help" className={styles.section}>
        <h2>Earlier referrals or missing names</h2>
        <p>If you referred someone manually before using the link, or their signup is missing from your list, contact the team. Send <strong>your GitHub username, their GitHub username, and the date you referred them</strong>. An admin can review and record eligible referrals for the relevant Wave; sending a message does not automatically qualify you for the bonus.</p>
        <p>You do not need to register every link signup on WhatsApp. Use your referral list to check that it was recorded. If a row shows a GitHub ID instead of a username, the referral record exists, but its username is not currently available.</p>
        <a className={styles.resource} href={contact} target="_blank" rel="noreferrer"><span><strong>Get referral help on WhatsApp</strong><small>Message the Plinger team - Opens a new tab</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
        <aside className={styles.note}><strong>Share your link, not your credentials</strong><p>Your referral link and code are safe to share. Never include your GitHub PAT, password, or bank details in a referral message.</p></aside>
      </section>
      <Link className={styles.resource} href="/docs/withdrawals"><span><small>Previous</small><strong>Withdraw your rewards</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
      <footer className={styles.footer}>Plinger guide <SupportLinks /></footer>
    </main>
    <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#how-it-works">How the reward works</a><a href="#refer-someone">Refer someone now</a><a href="#reward-limits">Rules and reward limits</a><a href="#referral-status">Referral status</a><a href="#referral-help">Earlier referrals and help</a></nav>
  </>;
}

function WhatsAppIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.1Z" /><path d="m8.3 7.4 1.5 2.4-1 1.1a8.6 8.6 0 0 0 4.3 4.3l1.1-1 2.4 1.5c-.2 1.3-1.3 2-2.5 1.6-3.8-1.2-6.7-4.1-7.9-7.9-.4-1.2.3-2.3 1.6-2.5Z" /></svg>;
}
