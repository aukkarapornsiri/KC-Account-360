import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { masterData } from "@/db/schema";

export type Permission = "read" | "create" | "post" | "approve" | "reconcile" | "export" | "manage_master" | "manage_users" | "manage_settings";
export type Access = { role: "Admin" | "Accountant" | "Approver" | "Viewer"; permissions: Permission[] };

const ROLE_PERMISSIONS: Record<Access["role"], Permission[]> = {
  Admin: ["read", "create", "post", "approve", "reconcile", "export", "manage_master", "manage_users", "manage_settings"],
  Accountant: ["read", "create", "post", "reconcile", "export", "manage_master"],
  Approver: ["read", "approve"],
  Viewer: ["read"],
};

export async function getUserAccess(email: string): Promise<Access> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(masterData).where(and(eq(masterData.category, "USER"), sql`lower(${masterData.name}) = ${normalizedEmail}`, eq(masterData.status, "Active"))).limit(1);
  if (!user) return { role: "Viewer", permissions: ROLE_PERMISSIONS.Viewer };
  let role: Access["role"] = "Viewer";
  try {
    const value = JSON.parse(user.metadata) as { role?: string };
    if (["Admin", "Accountant", "Approver", "Viewer"].includes(value.role || "")) role = value.role as Access["role"];
  } catch { role = user.description.includes("Administrator") ? "Admin" : "Viewer"; }
  return { role, permissions: ROLE_PERMISSIONS[role] };
}

export function hasPermission(access: Access, permission: Permission) {
  return access.permissions.includes(permission);
}
