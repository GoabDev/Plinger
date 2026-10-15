"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MaintenanceWatcher() {
  const pathname = usePathname();
  useEffect(() => {
    if (!["/dashboard", "/scouter"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return;
    let cancelled = false;
    let checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/api/maintenance", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (response.ok && (await response.json()).blocked && !cancelled) window.location.replace("/maintenance");
      } catch { /* Server-side checks still enforce maintenance during network failures. */ }
      finally { checking = false; }
    }
    void check();
    const interval = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener("focus", check); };
  }, [pathname]);
  return null;
}
