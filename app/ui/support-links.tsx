import { ArrowUpRight, MessageCircle, Users } from "lucide-react";
import { PLINGER_WHATSAPP_GROUP, PLINGER_WHATSAPP_CONTACTS } from "../../lib/support";
import styles from "./support-links.module.css";

export function SupportLinks() {
  return <div className={styles.support}>
    <div className={styles.heading}><strong>Contact Plinger</strong><span>Questions or issues? Message either number on WhatsApp.</span></div>
    <nav aria-label="Plinger support" className={styles.links}>
      {PLINGER_WHATSAPP_CONTACTS.map((contact) => <a key={contact.url} className={styles.contact} href={contact.url} target="_blank" rel="noreferrer" aria-label={`WhatsApp support: ${contact.number} (opens a new tab)`}><MessageCircle size={14} aria-hidden="true" /><span>{contact.number}</span><ArrowUpRight className={styles.arrow} size={12} aria-hidden="true" /></a>)}
      <a className={styles.contact} href={PLINGER_WHATSAPP_GROUP} target="_blank" rel="noreferrer" aria-label="Join the Plinger WhatsApp group (opens a new tab)"><Users size={14} aria-hidden="true" /><span>WhatsApp group</span><ArrowUpRight className={styles.arrow} size={12} aria-hidden="true" /></a>
    </nav>
  </div>;
}
