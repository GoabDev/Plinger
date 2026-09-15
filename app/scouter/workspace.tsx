"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronRight, CircleDot, LayoutDashboard, LockKeyhole, LogOut, Menu, Wallet } from "lucide-react";
import { Brand } from "../ui/brand";
import { signOut } from "../login/actions";

export const scouterViews = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "work", label: "My work", icon: CircleDot },
  { id: "pat", label: "GitHub PAT", icon: LockKeyhole },
  { id: "withdrawals", label: "Withdrawals", icon: Wallet },
] as const;
export type ScouterView = typeof scouterViews[number]["id"];

export default function ScouterWorkspace({ view, navigate, login, accountId, children }: {
  view: ScouterView; navigate: (view: ScouterView) => void; login?: string; accountId?: number | null; children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLElement>(null);
  function go(next: ScouterView) {
    navigate(next);
    setMenuOpen(false);
    content.current?.focus({ preventScroll: true });
  }
  const links = scouterViews.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-item ${view === id ? "active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => go(id)}><Icon size={18} aria-hidden="true" /><span>{label}</span></button>);
  return <div className="workspace scouter-workspace" onKeyDown={(event) => { if (event.key === "Escape" && menuOpen) { setMenuOpen(false); trigger.current?.focus(); } }}>
    <a className="skip-link" href="#scouter-content">Skip to content</a>
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <div className="workspace-label"><span className="workspace-avatar">{accountId ? <img src={`https://avatars.githubusercontent.com/u/${accountId}?s=64&v=4`} width={32} height={32} alt="" /> : <img src="/github-mark-white.svg" width={20} height={20} alt="" />}</span><div><strong>{login || "Your account"}</strong><span>Scouter workspace</span></div></div>
      <p className="nav-caption">WORKSPACE</p><nav aria-label="Scouter navigation">{links}</nav>
      <div className="sidebar-bottom"><a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="nav-item"><ArrowUpRight size={18} aria-hidden="true" /><span>GitHub connections</span></a><form action={signOut}><button type="submit" className="nav-item"><LogOut size={18} aria-hidden="true" /><span>Sign out</span></button></form><div className="sidebar-status"><span>Plinger / Scouter</span></div></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="breadcrumb"><button ref={trigger} type="button" className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="scouter-mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} aria-hidden="true" /><strong>{scouterViews.find((item) => item.id === view)?.label}</strong></div><div className="topbar-right"><span className="scouter-topbar-login">{login}</span><form className="scouter-mobile-signout" action={signOut}><button type="submit" className="icon-button" title="Sign out" aria-label="Sign out"><LogOut size={18} /></button></form></div></header>
      <nav id="scouter-mobile-navigation" aria-label="Scouter mobile navigation" className="scouter-mobile-navigation" hidden={!menuOpen}>{links}</nav>
      <main ref={content} tabIndex={-1} id="scouter-content" className="workspace-main">{children}</main>
    </div>
  </div>;
}
