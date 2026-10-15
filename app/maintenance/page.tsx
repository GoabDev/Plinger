import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wrench, ArrowRight } from "lucide-react";
import { maintenanceEnabled } from "../../lib/maintenance";
import { Brand } from "../ui/brand";
import styles from "./maintenance.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Back shortly", robots: { index: false, follow: false } };
export default function MaintenancePage() {
  if (!maintenanceEnabled()) redirect("/");
  return <main className={styles.shell}>
    <header className={styles.header}><Brand /></header>
    <section className={styles.content} aria-labelledby="maintenance-title">
      <span className={styles.icon}><Wrench size={28} aria-hidden="true" /></span>
      <p className={styles.eyebrow}>A LITTLE TIME TO MAKE THINGS BETTER</p>
      <h1 id="maintenance-title">We’ll be back shortly.</h1>
      <p className={styles.description}>Plinger is temporarily under maintenance while we make a few improvements. Your workspace will be available again soon.</p>
      <div className={styles.actions}><a className="button button-black" href="/scouter">Try again <ArrowRight size={16} aria-hidden="true" /></a><a className="button button-white" href="/docs">Read the scouter guide</a></div>
      <span className={styles.status}><span /> Maintenance in progress</span>
    </section>
    <a className={styles.developer} href="/login?developer=1">Are you the developer? <ArrowRight size={14} aria-hidden="true" /></a>
  </main>;
}
