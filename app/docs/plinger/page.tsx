import { SupportLinks } from "../../ui/support-links";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleDot, GitPullRequest, Network, Wallet } from "lucide-react";
import styles from "../docs.module.css";

const description = "Meet Plinger: the link between Drips Wave, scouters, and developers, bringing assigned issues, work progress, and earnings together.";

export const metadata: Metadata = {
  title: "What is Plinger? — Scouter guide",
  description,
  alternates: { canonical: "/docs/plinger" },
  openGraph: { title: "What is Plinger? — Scouter guide", description, url: "/docs/plinger" },
  twitter: { title: "What is Plinger? — Scouter guide", description },
};

export default function PlingerDocsPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Introduction <span>/</span> <span>Plinger</span></div>
        <div className={styles.titleIcon}><Network size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>GET TO KNOW PLINGER</p>
        <h1>What is Plinger?</h1>
        <p className={styles.lead}>Connecting scouters, developers, and the work in between.</p>
        <section id="what-is-plinger" className={styles.section} aria-label="About Plinger">
          <p>Plinger is the middleman between Drips Wave, scouters, and developers. It brings scouters’ assigned issues, work progress, and earnings into one place, making it easier for developers to keep track of the issues they help scouters complete.</p>
          <p>Think of an issue as a task that a project needs help with. Plinger keeps that task connected to the scouter it belongs to and the work being done on it, so the team can see what needs attention and what has been completed.</p>
        </section>
        <section id="how-everyone-connects" className={styles.section}>
          <h2>How everyone connects</h2>
          <p>Drips Wave is where participating projects offer tasks and reward contributions. Scouters find and secure issues to work on, while developers help with the technical work needed to complete them. Plinger helps coordinate that work by keeping the scouters’ issues, related updates, and earnings organised.</p>
        </section>
        <section id="what-plinger-tracks" className={styles.section}>
          <h2>What Plinger keeps track of</h2>
          <ul className={styles.steps}>
            <li><span className={styles.stepIcon}><CircleDot size={18} aria-hidden="true" /></span><div><h3>Scouters’ issues</h3><p>See which tasks are assigned to each scouter and whether they are still open or have been closed.</p></div></li>
            <li><span className={styles.stepIcon}><GitPullRequest size={18} aria-hidden="true" /></span><div><h3>Work in progress</h3><p>Follow the proposed changes linked to an issue, called pull requests, and see whether they are open, accepted into the project, or closed.</p></div></li>
            <li><span className={styles.stepIcon}><Wallet size={18} aria-hidden="true" /></span><div><h3>Earnings and payments</h3><p>Keep withdrawal proofs, earnings awaiting confirmation, confirmed earnings, and payment status organised for each scouter.</p></div></li>
          </ul>
        </section>
        <aside className={styles.note}><strong>Less chasing updates. A clearer view of the work.</strong><p>With these details together, the team can follow a scouter’s issue from assignment through development and keep track of the related earnings.</p></aside>
        <Link className={styles.resource} href="/docs"><span><small>Previous</small><strong>What is Drips Wave?</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
        <Link className={styles.resource} href="/docs/getting-started/github-account"><span><small>Next</small><strong>Create a GitHub account</strong></span><ArrowRight size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide<SupportLinks /></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#what-is-plinger">What is Plinger?</a><a href="#how-everyone-connects">How everyone connects</a><a href="#what-plinger-tracks">What Plinger tracks</a></nav>
    </>
  );
}
