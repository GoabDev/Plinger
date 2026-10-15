import { SupportLinks } from "../ui/support-links";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, CircleDot, Gift, Waves } from "lucide-react";
import styles from "./docs.module.css";

const description = "Learn what Drips Wave is, how contributions work, and how completed tasks earn points and rewards.";

export const metadata: Metadata = {
  title: "Drips Wave — Scouter guide",
  description,
  alternates: { canonical: "/docs" },
  openGraph: { title: "Drips Wave — Plinger guide", description, url: "/docs" },
  twitter: { title: "Drips Wave — Plinger guide", description },
};

export default function DocsPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Introduction <span>/</span> <span>Drips Wave</span></div>
        <div className={styles.titleIcon}><Waves size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>START WITH THE BASICS</p>
        <h1>What is Drips Wave?</h1>
        <p className={styles.lead}>Help improve projects. Earn rewards for your contribution.</p>
        <section id="what-is-drips-wave" className={styles.section} aria-label="About Drips Wave">
          <p>Drips Wave is a program where people earn rewards by helping improve open-source projects—software that anyone can view and contribute to. Each “Wave” is a short contribution period where participating projects share tasks, such as fixing bugs, adding features, or improving documentation.</p>
          <p>Contributors earn points for completed, verified tasks. After the Wave ends, those points determine their share of the available reward pool.</p>
        </section>
        <section id="how-it-works" className={styles.section}>
          <h2>How a Wave works</h2>
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}><CircleDot size={18} aria-hidden="true" /></span><div><h3>Find a task</h3><p>Browse the tasks shared by participating projects and apply for one you can help with.</p></div></li>
            <li><span className={styles.stepIcon}><Check size={18} aria-hidden="true" /></span><div><h3>Complete the work</h3><p>Submit your contribution for review. When your assigned task is confirmed as completed, you earn points.</p></div></li>
            <li><span className={styles.stepIcon}><Gift size={18} aria-hidden="true" /></span><div><h3>Earn your share</h3><p>After the Wave and its review period, eligible contributors receive rewards based on their share of the total points.</p></div></li>
          </ol>
        </section>
        <aside className={styles.note}><strong>A quick note on rewards</strong><p>Points don’t have a fixed cash value. Your reward depends on the available reward pool and the total points earned during that Wave.</p></aside>
        <section id="learn-more" className={styles.section}>
          <h2>Go a little deeper</h2>
          <p>For participation requirements and the latest program details, visit the official Drips guide.</p>
          <a className={styles.resource} href="https://docs.drips.network/wave/" target="_blank" rel="noreferrer"><span><strong>Explore Drips Wave</strong><small>Official overview, rules, and contributor guides</small></span><ArrowUpRight size={20} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
        </section>
        <Link className={styles.resource} href="/docs/plinger"><span><small>Next</small><strong>What is Plinger?</strong></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide<SupportLinks /></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#what-is-drips-wave">What is Drips Wave?</a><a href="#how-it-works">How a Wave works</a><a href="#learn-more">Go a little deeper</a></nav>
    </>
  );
}
