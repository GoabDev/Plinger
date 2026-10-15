import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAINTENANCE_COOKIE, maintenanceEnabled, validMaintenancePass } from "../../../lib/maintenance";
import { Brand } from "../../ui/brand";
import { endMaintenanceAccess } from "./actions";
import styles from "../maintenance.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Developer access", robots: { index: false, follow: false } };
export default async function MaintenanceAccess() {
  if (!maintenanceEnabled()) redirect("/dashboard");
  if (!validMaintenancePass((await cookies()).get(MAINTENANCE_COOKIE)?.value)) redirect("/login?developer=1");
  return <main className={styles.shell}><header className={styles.header}><Brand /></header><section className={styles.content}>
    <p className={styles.eyebrow}>DEVELOPER ACCESS</p><h1>You’re ready to test.</h1>
    <p className={styles.description}>This browser can access Plinger during maintenance for two hours. You can sign in with GitHub to test the scouter experience without losing this access.</p>
    <div className={styles.actions}><a className="button button-black" href="/scouter/login">Test as a scouter</a><a className="button button-white" href="/dashboard">Open admin dashboard</a></div>
    <form action={endMaintenanceAccess}><button className="button button-white" style={{ marginTop: 24 }} type="submit">End developer access</button></form>
  </section></main>;
}
