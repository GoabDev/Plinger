import { createHmac, timingSafeEqual } from "node:crypto";

export const MAINTENANCE_COOKIE = "plinger-maintenance-pass";
export const MAINTENANCE_PASS_SECONDS = 2 * 60 * 60;
export const maintenanceEnabled = () => process.env.PLINGER_MAINTENANCE === "true";

function signature(payload: string) {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.PLINGER_ADMIN_EMAIL) throw new Error("Maintenance access is not configured");
  return createHmac("sha256", key).update(`plinger:maintenance:v1:${process.env.PLINGER_ADMIN_EMAIL.toLowerCase()}:${payload}`).digest("hex");
}
export function createMaintenancePass(now = Date.now()) {
  const expires = String(now + MAINTENANCE_PASS_SECONDS * 1000);
  return `${expires}.${signature(expires)}`;
}
export function validMaintenancePass(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [expires, mac] = parts;
  if (!/^\d{13}$/.test(expires) || !/^[a-f0-9]{64}$/.test(mac)) return false;
  if (Number(expires) <= now || Number(expires) > now + MAINTENANCE_PASS_SECONDS * 1000) return false;
  try { return timingSafeEqual(Buffer.from(mac), Buffer.from(signature(expires))); }
  catch { return false; }
}
export function maintenanceProtectedPath(path: string) {
  if (["/api/github/webhook", "/api/github/sync", "/api/maintenance"].includes(path)) return false;
  return ["/dashboard", "/scouter", "/api", "/r"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
