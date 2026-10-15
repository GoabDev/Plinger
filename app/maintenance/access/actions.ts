"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAINTENANCE_COOKIE } from "../../../lib/maintenance";

export async function endMaintenanceAccess() {
  (await cookies()).delete(MAINTENANCE_COOKIE);
  redirect("/maintenance");
}
