import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CircleDot } from "lucide-react";
import styles from "../../docs.module.css";
import ApplyingVideo from "./applying-video";
import AiTemplate from "./ai-template";

const guide = "https://docs.drips.network/wave/contributors/solving-issues-and-earning-rewards/";
const tips = "https://www.drips.network/blog/posts/your-guide-to-contributing-well-in-wave";
const description = "Learn how to find Drips Wave issues, write an application, check limits, and follow your assignment as a Plinger scouter.";

export const metadata: Metadata = {
  title: "Apply for issues on Drips Wave — Scouter guide", description,
  alternates: { canonical: "/docs/working-on-issues/applying" },
  openGraph: { title: "Apply for issues on Drips Wave — Plinger guide", description, url: "/docs/working-on-issues/applying" },
  twitter: { title: "Apply for issues on Drips Wave — Plinger guide", description },
};

export default function ApplyingForIssuesPage() {
  return (
    <>
      <main id="docs-content" className={styles.article} tabIndex={-1}>
        <div className={styles.breadcrumb}>Working on issues <span>/</span> <span>Applying</span></div>
        <div className={styles.titleIcon}><CircleDot size={26} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>FIND YOUR FIRST ISSUE</p>
        <h1>Apply for issues on Drips Wave</h1>
        <p className={styles.lead}>Find a suitable task, explain how you can help, and wait for your assignment.</p>
        <section id="watch-the-walkthrough" className={styles.section}>
          <h2>Watch this first · 5 minutes</h2>
          <p>Start with this mobile walkthrough before applying for your first issue. It shows where to find issues, which filters to use, how to prepare your application, and where to check your assignments. Watch here, then use the written steps below as a reminder.</p>
          <ApplyingVideo />
          <p id="walkthrough-context" className={styles.caption}>Recorded walkthrough, 5:05. Wave dates, points, availability, and limits shown are examples from the recording. Check the current Wave before applying. The written guide below covers the steps too.</p>
        </section>
        <section id="before-you-apply" className={styles.section}>
          <h2>Before you apply</h2>
          <p>Sign in with your GitHub account and complete <Link href="/docs/getting-started/drips-wave-account#complete-verification">Drips identity verification</Link>. Have your <Link href="/docs/getting-started/plinger-account">Plinger setup</Link> ready too. If a developer will help you, agree on the scope and timing before committing to an issue.</p>
        </section>
        <section id="find-an-issue" className={styles.section}>
          <h2>1. Find an available issue</h2>
          <p>Open Explore in <a href="https://www.drips.network/wave" target="_blank" rel="noreferrer">Drips Wave (new tab)</a>, choose a program with an active Wave, then open Issues. Filter for unassigned issues or those without applications. Check the deadline, requirements, and point value before choosing.</p>
          <p>On mobile, open the menu and choose <strong>Explore Waves</strong>. The video shows <strong>Preview issues</strong> for an upcoming Wave; previewing lets you browse, but check when that Wave opens for applications.</p>
          <p>To follow the filters in the video, select <strong>Open</strong>, <strong>Not assigned</strong>, and <strong>No applications</strong>, then press <strong>Apply filters</strong>. These help narrow the list; an issue with existing applications may still accept yours. Open a task, expand <strong>Show more</strong>, and use <strong>View on GitHub</strong> to read the full context.</p>
          <figure className={styles.screenshot}>
            <a href="/docs/drips-wave/issues.png" target="_blank" rel="noreferrer" aria-label="Open Drips issue-browser screenshot full size in a new tab">
              <Image src="/docs/drips-wave/issues.png" width={1270} height={728} alt="Drips Wave issue browser with filters and issue list on the left, task description in the centre, and Apply to work on this issue beneath the description" sizes="(max-width: 700px) 90vw, 708px" />
            </a>
            <figcaption>Illustrative screenshot from <a href={guide}>Drips’ official contributor guide</a>. It includes an assigned issue and maintainer-only controls; your available actions may differ. Select the image to enlarge it.</figcaption>
          </figure>
          <ul className={styles.steps}>
            <li><span className={styles.stepIcon}>1</span><div><h3>Left: browse and filter</h3><p>Use the issue list to compare tasks. Open one to read its full description.</p></div></li>
            <li><span className={styles.stepIcon}>2</span><div><h3>Centre: understand the task</h3><p>Read what needs changing and check any linked GitHub details. If a requirement is unclear, ask before promising a solution.</p></div></li>
            <li><span className={styles.stepIcon}>3</span><div><h3>Right: check the details</h3><p>Look at the assignment, due date, points, and complexity. A high point value alone doesn’t make a task a good fit.</p></div></li>
          </ul>
        </section>
        <section id="write-your-application" className={styles.section}>
          <h2>2. Write a clear application</h2>
          <p>Select Apply, or Apply to work on this issue. Use the message box to briefly explain your relevant experience and how you would approach the task. <a href="https://docs.drips.network/wave/contributors/faq/">Drips’ application FAQ</a> describes this step.</p>
          <p>The video uses ChatGPT to help draft a short message from an issue link. If you do the same, read the issue first and review every sentence. Replace any invented skills or experience with true details, and agree on the approach and timing with your developer before submitting.</p>
          <p>Make the message specific to the issue. Mention what you understand, the work you can realistically deliver, and any relevant example. Avoid generic applications sent to many tasks. Be accurate about your experience and who will do the work. <a href={tips}>Drips’ contributor tips</a> explain what makes a useful application.</p>
          <aside className={styles.note}><strong>A structure you can adapt</strong><p>“I’ve read the requirements for [specific task]. My approach would be [brief plan]. My relevant experience is [true example or link], and I expect to complete it within [realistic time].”</p><p>Replace every bracket with accurate details. Check the plan with your developer first if you need their help.</p></aside>
          <p>Review the message and submit your application. Applying expresses interest; it doesn’t guarantee selection or earnings.</p>
        </section>
        <AiTemplate />
        <section id="application-limits" className={styles.section}>
          <h2>Know your application limits</h2>
          <p>Drips currently lists a maximum of <strong>15 pending applications</strong> and <strong>4 assigned issues per organization within a Wave</strong>. Check your <a href="https://www.drips.network/wave/contributors/limit-details" target="_blank" rel="noreferrer">application limits dashboard (new tab)</a> for the items counting against your allowance.</p>
          <p className={styles.caption}>Limits can change. See the <a href={`${guide}#application-limits`}>official application-limit rules</a>. Checked 14 October 2026.</p>
        </section>
        <section id="after-applying" className={styles.section}>
          <h2>3. Let the developers take it from here</h2>
          <p>Your main job as a scouter is to find suitable issues and apply. When an issue is assigned to you and syncs to Plinger, the developers can see it in their workspace and start working on it.</p>
          <p>You don’t need to send each assigned issue to a developer or closely follow every application. The developers use Plinger to pick up assignments and manage the development work.</p>
          <p>If you want to check progress, you can view <strong>My work</strong> in your Plinger workspace while continuing to focus on applying for suitable issues.</p>
        </section>
        <section id="need-help" className={styles.section}>
          <h2>If you can’t apply</h2>
          <div className={styles.helpList}>
            <details><summary>Drips asks me to verify my identity</summary><p>Complete verification before applying. Our <Link href="/docs/getting-started/drips-wave-account#verification-help">verification guide</Link> covers document preparation and common problems.</p></details>
            <details><summary>I have reached an application limit</summary><p>Review the limits dashboard. Withdraw applications you no longer intend to pursue or finish existing work. Don’t apply just to fill every available slot.</p></details>
            <details><summary>My application has no response</summary><p>Check its status under Contributors → Issues. Maintainers may be reviewing several applicants; avoid repeated messages. An application still awaiting a decision isn’t an assignment.</p></details>
          </div>
          <Link className={styles.resource} href="/docs/getting-started/drips-wave-account#watch-the-guide"><span><strong>Watch the application walkthrough</strong><small>Choose “Applying to issues” for the 2:00–3:13 clip</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        </section>
        <Link className={styles.resource} href="/docs/getting-started/plinger-account"><span><small>Previous</small><strong>Create your Plinger account</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
        <Link className={styles.resource} href="/docs/withdrawals"><span><small>Next</small><strong>Withdraw your rewards</strong></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        <footer className={styles.footer}>Plinger guide <span>Made for scouters, one step at a time.</span></footer>
      </main>
      <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#watch-the-walkthrough">Watch the walkthrough</a><a href="#before-you-apply">Before you apply</a><a href="#find-an-issue">Find an issue</a><a href="#write-your-application">Write your application</a><a href="#ai-application-template">AI application template</a><a href="#application-limits">Application limits</a><a href="#after-applying">After you apply</a><a href="#need-help">If you can’t apply</a></nav>
    </>
  );
}
