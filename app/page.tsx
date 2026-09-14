const setupItems = [
  {
    label: "GitHub App created",
    detail: "Plinger now exists at github.com/apps/plinger.",
    done: true,
  },
  {
    label: "Webhook endpoint",
    detail: "POST /api/github/webhook verifies GitHub signatures.",
    done: true,
  },
  {
    label: "Local tunnel",
    detail: "Expose localhost so GitHub can deliver webhooks during development.",
    done: false,
  },
  {
    label: "Database",
    detail: "Persist installations, repositories, issues, pull requests, and events.",
    done: false,
  },
];

export default function Home() {
  return (
    <main className="shell">
      <section className="panel">
        <div className="brandRow">
          <img src="/plinger-icon.png" alt="" className="icon" />
          <div>
            <p className="eyebrow">GitHub App dashboard</p>
            <h1>Plinger</h1>
          </div>
        </div>

        <p className="lede">
          Track issue assignments, pull request activity, merged PRs, and repo
          signals from one quiet command center.
        </p>

        <div className="statusGrid" aria-label="Setup progress">
          {setupItems.map((item) => (
            <article className="statusItem" key={item.label}>
              <span className={item.done ? "dot done" : "dot"} />
              <div>
                <h2>{item.label}</h2>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="endpoint">
          <span>Webhook URL</span>
          <code>/api/github/webhook</code>
        </div>
      </section>
    </main>
  );
}
