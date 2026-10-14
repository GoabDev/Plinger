import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import styles from "../docs.module.css";
import WithdrawalVideo from "./withdrawal-video";

const guide = "https://docs.drips.network/wave/withdrawing-rewards/";
const media = "https://qkjnsxyozetkmorpmxbe.supabase.co/storage/v1/object/public/docs-media/drips-wave/";
const description = "Withdraw your Drips Wave rewards to Plinger, wait for completion, and submit your transaction and withdrawal proof.";
export const metadata: Metadata = {
  title: "Withdraw your rewards — Scouter guide", description,
  alternates: { canonical: "/docs/withdrawals" },
  openGraph: { title: "Withdraw your rewards — Plinger guide", description, url: "/docs/withdrawals" },
};

export default function WithdrawalsPage() {
  return <>
    <main id="docs-content" className={styles.article} tabIndex={-1}>
      <div className={styles.breadcrumb}>Earnings <span>/</span> <span>Withdrawals</span></div>
      <div className={styles.titleIcon}><Wallet size={26} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>FROM REWARD TO PAYMENT</p>
      <h1>Withdraw your rewards</h1>
      <p className={styles.lead}>Check your allocation, withdraw to Plinger, then submit proof after the withdrawal is complete.</p>
      <aside className={styles.note}><strong>Copy Plinger’s public key. Leave the memo empty.</strong><p>Get the current key from <strong>Plinger → Earnings → Drip Wave withdrawal</strong>. This is a Stellar public address, not your GitHub PAT or a private key. Check the pasted address against Plinger before confirming. The no-memo instruction applies specifically to this Plinger destination.</p></aside>

      <section id="watch-step-one" className={styles.section}>
        <h2>Watch first: request your withdrawal</h2>
        <p>This 2:48 mobile walkthrough shows where to copy the key, open your grant, and request a withdrawal. Watch it before submitting yours.</p>
        <WithdrawalVideo src={`${media}withdrawal-request-f83a3c765b0a.mp4`} poster="/docs/drips-wave/withdrawal-1-poster.jpg" title="Request a Drips Wave withdrawal" chapters={[
          { time: 18, label: "Find Plinger’s withdrawal key", stamp: "0:18" },
          { time: 50, label: "Open Reward Grants", stamp: "0:50" },
          { time: 65, label: "Enter the address, leave memo empty", stamp: "1:05" },
          { time: 96, label: "Check the pending status", stamp: "1:36" },
        ]} />
        <p className={styles.caption}>Personal bank details are masked in the recording. Amounts, dates, and transactions are examples. Always use your own completed withdrawal for verification.</p>
      </section>

      <section id="check-your-grant" className={styles.section}>
        <h2>1. Check your reward allocation</h2>
        <p>When rewards are released, open <strong>Wave → Reward Grants</strong> in Drips. Select your grant and check the allocation, available amount, status, and expiry. Proceed when it is <strong>Withdrawable</strong>. Identity verification must be approved. <a href={guide}>Drips’ withdrawal guide.</a></p>
        <p>Use the amount shown on your grant when reviewing the withdrawal. Don’t use the recording’s amount as your expected earnings.</p>
      </section>

      <section id="request-withdrawal" className={styles.section}>
        <h2>2. Copy the key and request withdrawal</h2>
        <ul className={styles.steps}>
          <li><span className={styles.stepIcon}>1</span><div><h3>Copy from Plinger</h3><p>Sign in to <Link href="/scouter">Plinger</Link>, open Earnings, and find Drip Wave withdrawal. Use the copy button beside Stellar public key. Don’t type the key manually or copy it from the video.</p></div></li>
          <li><span className={styles.stepIcon}>2</span><div><h3>Paste into Drips</h3><p>Open your grant and choose Request full withdrawal. Paste the copied key into Stellar address. Leave Memo blank. If an old address or memo is filled in, check and correct it before continuing.</p></div></li>
          <li><span className={styles.stepIcon}>3</span><div><h3>Review, then confirm</h3><p>Match the destination to the key in Plinger, check the amount, and make sure the confirmation says No memo. Read the terms and confirm only when everything matches. An incorrect address can cause loss of funds.</p></div></li>
        </ul>
      </section>

      <section id="wait-for-completion" className={styles.section}>
        <h2>3. Wait until the withdrawal is complete</h2>
        <p><strong>Withdrawal Pending</strong> means processing. Wait for the completion email or check for <strong>Withdrawal Complete</strong> in Drips. Full withdrawals usually take 1–3 business days. The completed transaction history includes a Stellar Expert link. <a href={`${guide}#processing-time`}>Processing and transaction history.</a></p>
        <aside className={styles.note}><strong>Pending is not proof of completion</strong><p>Don’t upload a pending request as a completed withdrawal. The first video later opens an older transaction as an example. Use the transaction belonging to the withdrawal you are submitting.</p></aside>
      </section>

      <section id="submit-proof" className={styles.section}>
        <h2>4. Upload your withdrawal verification to Plinger</h2>
        <p>Watch this 1:23 desktop example after Drips confirms completion. It shows the transaction link, proof upload, and the submitted earning.</p>
        <WithdrawalVideo landscape src={`${media}withdrawal-verification-18b74e0ecd9e.mp4`} poster="/docs/drips-wave/withdrawal-2-poster.jpg" title="Submit withdrawal verification in Plinger" chapters={[
          { time: 5, label: "Open the completed transaction", stamp: "0:05" },
          { time: 32, label: "Paste the transaction link", stamp: "0:32" },
          { time: 48, label: "Upload proof and submit", stamp: "0:48" },
        ]} />
        <ul className={styles.steps}>
          <li><span className={styles.stepIcon}>1</span><div><h3>Save your completed transaction details</h3><p>Open the completed withdrawal’s Stellar Expert link and copy its URL or transaction hash. Save a clear screenshot or PDF showing the successful transaction, amount, and destination.</p></div></li>
          <li><span className={styles.stepIcon}>2</span><div><h3>Open Submit an earning</h3><p>In Plinger’s Earnings page, paste the reference into Stellar transaction URL or hash. Upload the matching file under Drip Wave withdrawal confirmation. Accepted formats are PNG, JPG, WebP, and PDF, up to 10 MB.</p></div></li>
          <li><span className={styles.stepIcon}>3</span><div><h3>Verify and submit</h3><p>Select Verify and submit earning. Plinger checks the payment on Stellar, including its amount, USDC asset, and Plinger destination. Wait for submission to succeed and check that the earning appears below the form. Submit each transaction only once.</p></div></li>
        </ul>
      </section>

      <section id="after-submitting" className={styles.section}>
        <h2>5. Follow your earning and bank payout</h2>
        <p>A newly submitted earning can be pending review in Plinger even though the Drips withdrawal is complete. Follow its status in Earnings: <strong>confirmed</strong> means the earning has been approved; <strong>Payout due</strong> means payment is still outstanding; <strong>Paid</strong> means the payout has been recorded.</p>
        <p>Check your saved Bank withdrawal details. Plinger shows your 60% share separately from the gross amount. A completed Drips withdrawal does not by itself mean your bank payout is complete.</p>
      </section>

      <section id="withdrawal-help" className={styles.section}>
        <h2>If something goes wrong</h2>
        <div className={styles.helpList}>
          <details><summary>I entered the wrong destination</summary><p>If still pending, cancel through Reward Grants and contact Drips support immediately. Completed transfers cannot be reversed. <a href={`${guide}#troubleshooting`}>Drips troubleshooting.</a></p></details>
          <details><summary>Plinger cannot verify my transaction</summary><p>Check that you copied the completed transaction’s Stellar Expert public-network URL or full hash. It must be a successful USDC payment to Plinger. If verification is temporarily unavailable, retry later. If it says the transaction was already submitted, check your existing earnings first.</p></details>
          <details><summary>My upload is rejected</summary><p>Use one PNG, JPG, WebP, or PDF no larger than 10 MB. Make sure it is readable and belongs to the transaction you entered. If the earning itself is marked rejected, contact the Plinger team for clarification before submitting again.</p></details>
        </div>
      </section>
      <Link className={styles.resource} href="/docs/working-on-issues/applying"><span><small>Previous</small><strong>Applying for issues</strong></span><ArrowLeft size={20} aria-hidden="true" /></Link>
      <footer className={styles.footer}>Plinger guide <span>Withdrawal guidance checked 14 October 2026.</span></footer>
    </main>
    <nav className={styles.contents} aria-label="On this page"><p>On this page</p><a href="#watch-step-one">Watch the walkthrough</a><a href="#check-your-grant">Check your allocation</a><a href="#request-withdrawal">Request withdrawal</a><a href="#wait-for-completion">Wait for completion</a><a href="#submit-proof">Upload verification</a><a href="#after-submitting">Follow your payout</a><a href="#withdrawal-help">Get help</a></nav>
  </>;
}
