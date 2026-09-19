import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleDot,
  GitMerge,
  GitPullRequest,
  Radio,
} from "lucide-react";
import { Brand } from "./ui/brand";
import { ThemeToggle } from "./ui/theme-toggle";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Brand />
        <div className="landing-nav-links">
          <a href="#workflow">The workflow</a>
          <a
            href="https://github.com/apps/plinger"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="flex items-center gap-2.5">
          <ThemeToggle inverted />
          <Link className="button button-light max-[700px]:hidden" href="/scouter/login">
            Open dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-brand-image" aria-hidden="true">
          <img src="/plinger-icon.png" alt="" width={112} height={112} />
        </div>
        <p className="hero-kicker">
          <span className="status-dot" /> A little signal. A lot more clarity.
        </p>
        <h1>
          Plinger<span className="brand-period">.</span>
        </h1>
        <p className="hero-title">Your repositories. One clear picture.</p>
        <p className="hero-description">
          Keep up with the issues, pull requests, and pushes that move your work
          forward. All together, without the tab hopping.
        </p>
        <div className="hero-actions">
          <Link className="button button-light" href="/scouter/login">
            Open your dashboard <ArrowRight size={17} />
          </Link>
          <a
            className="button button-dark-outline"
            href="https://github.com/apps/plinger/installations/new"
          >
            <img src="/github-mark-white.svg" width={17} height={17} alt="" aria-hidden="true" /> Connect GitHub
          </a>
        </div>
        <a className="hero-scroll" href="#workflow">
          A closer look <ArrowDown size={14} />
        </a>
      </section>
      <section
        className="product-section"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <div className="section-heading">
          <div>
            <p className="overline">LESS CHECKING. MORE BUILDING.</p>
            <h2 id="workflow-title">Pick up exactly where work stands.</h2>
          </div>
          <span className="preview-label">
            <Radio size={14} /> Dashboard preview · Example activity
          </span>
        </div>
        <div className="product-preview">
          <aside className="preview-sidebar">
            <Brand />
            <span className="preview-nav-active">
              <Radio size={16} /> Overview
            </span>
            <span>
              <BookOpen size={16} /> Repositories
            </span>
            <span>
              <CircleDot size={16} /> Issues <b>3</b>
            </span>
            <span>
              <GitPullRequest size={16} /> Pull requests <b>2</b>
            </span>
          </aside>
          <div className="preview-main">
            <div className="preview-top">
              <span>
                Workspace <span className="muted"> / Overview</span>
              </span>
              <span className="badge green">
                <span className="status-dot" /> Connected
              </span>
            </div>
            <div className="preview-intro">
              <h3>A good day to ship.</h3>
              <span className="muted">
                Here is what is happening across your repositories.
              </span>
            </div>
            <div className="preview-stats">
              <div>
                <BookOpen size={17} />
                <span>Repositories</span>
                <strong>4</strong>
              </div>
              <div>
                <CircleDot size={17} />
                <span>Open issues</span>
                <strong>3</strong>
              </div>
              <div>
                <GitPullRequest size={17} />
                <span>Open pull requests</span>
                <strong>2</strong>
              </div>
              <div>
                <GitMerge size={17} className="purple-text" />
                <span>Merged</span>
                <strong>12</strong>
              </div>
            </div>
            <div className="preview-feed">
              <h4>
                Recent activity{" "}
                <span className="muted">Across your workspace</span>
              </h4>
              <PreviewEvent
                type="merged"
                title="Simplify the onboarding flow"
                repo="acme / web"
                time="2m ago"
              />
              <PreviewEvent
                type="issue"
                title="Improve search on mobile"
                repo="acme / web"
                time="18m ago"
              />
              <PreviewEvent
                type="pr"
                title="Add repository filters"
                repo="acme / api"
                time="32m ago"
              />
            </div>
          </div>
        </div>
      </section>
      <section className="feature-band" aria-label="What Plinger tracks">
        <article>
          <span className="feature-icon blue">
            <Radio size={21} />
          </span>
          <h3>Every update, in context.</h3>
          <p>
            Follow pushes, issue updates, and pull request activity across your
            connected repositories.
          </p>
        </article>
        <article>
          <span className="feature-icon green">
            <CircleDot size={21} />
          </span>
          <h3>Know what needs you.</h3>
          <p>
            Keep open issues and assignments in view, with a direct path back to
            the work on GitHub.
          </p>
        </article>
        <article>
          <span className="feature-icon purple">
            <GitMerge size={21} />
          </span>
          <h3>Follow the work to merged.</h3>
          <p>
            See active pull requests alongside completed merges, from the next
            review to the latest release.
          </p>
        </article>
      </section>
      <footer className="landing-footer">
        <Brand />
        <span>A clearer view of your GitHub work.</span>
        <Link href="/scouter/login">
          Let&apos;s see what&apos;s happening <ArrowRight size={16} />
        </Link>
      </footer>
    </main>
  );
}
function PreviewEvent({
  type,
  title,
  repo,
  time,
}: {
  type: "merged" | "issue" | "pr";
  title: string;
  repo: string;
  time: string;
}) {
  const Icon =
    type === "merged"
      ? GitMerge
      : type === "issue"
        ? CircleDot
        : GitPullRequest;
  return (
    <div className="preview-event">
      <span className={`event-icon ${type === "merged" ? "purple" : "green"}`}>
        <Icon size={17} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>
          {repo}{" "}
          <span>
            ·{" "}
            {type === "merged"
              ? "Pull request merged"
              : type === "issue"
                ? "Issue assigned"
                : "Pull request opened"}
          </span>
        </p>
      </div>
      <time>{time}</time>
    </div>
  );
}
