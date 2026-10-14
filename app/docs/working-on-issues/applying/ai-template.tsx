"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import styles from "../../docs.module.css";
import promptStyles from "./ai-template.module.css";

const template = `I want to apply to work on a GitHub issue.

Write me a short application/comment that I can post directly under the issue.

Style requirements:

* Start naturally with “Hi maintainer,” when appropriate.
* Keep it concise, ideally 2–3 sentences.
* Make it sound like a real developer volunteering to work on the issue, not a job application.
* Avoid corporate language, excessive enthusiasm, buzzwords, and anything that sounds AI-generated.
* Don’t over-explain my experience unless it is directly relevant.
* Mention specifically what I would do to solve the issue so the maintainer knows I actually understand it.
* Sound confident but not arrogant.
* Don’t say things like “I am excited to contribute,” “I believe I would be a great fit,” or “I look forward to the opportunity.”
* Don’t use em dashes.
* Don’t make up technical details that aren’t in the issue.
* Keep the wording natural and straightforward.

Here is the GitHub issue:

[PASTE ISSUE LINK HERE]

First understand what the issue is asking for, then give me only the final application message I can post.`;
const videoSource = "https://qkjnsxyozetkmorpmxbe.supabase.co/storage/v1/object/public/docs-media/drips-wave/ai-application-template-d1b779864f8a.mp4";

export default function AiTemplate() {
  const prompt = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setStatus("Template copied. Paste it into your AI chat and replace the issue-link placeholder.");
    } catch {
      setCopied(false);
      prompt.current?.focus();
      prompt.current?.select();
      setStatus("Copy was unavailable. The template is selected so you can copy it manually.");
    }
  }
  return (
    <section id="ai-application-template" className={styles.section}>
      <h2>Use the AI application template</h2>
      <p>Watch this 1-minute 24-second example to see how to use the template and get another application by sending just the next issue link.</p>
      <video className={styles.walkthroughVideo} controls playsInline preload="none" poster="/docs/drips-wave/ai-template-poster.jpg" width={384} height={832} src={videoSource} aria-label="How to use and reuse the AI application template" onError={() => setVideoFailed(true)}>
        Your browser does not support embedded video. <a href={videoSource}>Open the template walkthrough</a>.
      </video>
      {videoFailed && <p role="status">The video could not load. <a href={videoSource}>Open the video directly</a> or follow the instructions below.</p>}
      <ol className={promptStyles.instructions}>
        <li>Copy the template below and paste it into your AI chat.</li>
        <li>Replace <strong>[PASTE ISSUE LINK HERE]</strong> with the GitHub link for the issue you want to apply for, then send the message.</li>
        <li>Read the reply and check that the proposed work matches the issue and what your developer can deliver before posting it.</li>
      </ol>
      <div className={promptStyles.panel}>
        <div className={promptStyles.toolbar}>
          <div><label className={promptStyles.label} htmlFor="application-ai-prompt">Application prompt</label><p className={promptStyles.hint} id="prompt-hint">Copy once. Replace the issue link. Send.</p></div>
          <button className={promptStyles.copy} type="button" onClick={() => void copy()}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "Copied" : "Copy template"}</button>
        </div>
        <div className={promptStyles.body}>
          <textarea className={promptStyles.prompt} ref={prompt} id="application-ai-prompt" aria-describedby="prompt-hint" readOnly value={template} rows={18} spellCheck={false} />
          <p className={promptStyles.status} role="status">{status || "Scroll to read the full prompt. The copy button copies all of it."}</p>
        </div>
      </div>
      <aside className={styles.note}>
        <strong>One template, then just issue links</strong>
        <p>You don’t need to copy this long prompt for every issue. Stay in the same AI conversation and paste the next GitHub issue link as a new message. The AI can use the instructions already in that chat to draft another application.</p>
        <p>If you start a new chat, or the AI stops following the style, paste the template again. If it cannot open an issue link, paste the issue title and description so it has the details it needs.</p>
      </aside>
    </section>
  );
}
