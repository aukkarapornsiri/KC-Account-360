import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { masterData, userCompanyRoles } from "@/db/schema";

export type Permission = "read" | "create" | "post" | "approve" | "reconcile" | "close_period" | "review_ai" | "export" | "manage_master" | "manage_users" | "manage_settings" | "manage_integrations";
export type Access = { role: "Admin" | "Accountant" | "Approver" | "Viewer"; permissions: Permission[] };

const ROLE_PERMISSIONS: Record<Access["role"], Permission[]> = {
  Admin: ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master", "manage_users", "manage_settings", "manage_integrations"],
  Accountant: ["read", "create", "post", "reconcile", "close_period", "review_ai", "export", "manage_master"],
  Approver: ["read", "approve", "review_ai"],
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

export async function getCompanyAccess(email: string, tenantId: string, companyId: string): Promise<Access | null> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const roles = await db.select({ role: userCompanyRoles.role }).from(userCompanyRoles).where(and(
    eq(userCompanyRoles.tenantId, tenantId),
    eq(userCompanyRoles.companyId, companyId),
    sql`lower(${userCompanyRoles.userId}) = ${normalizedEmail}`,
    eq(userCompanyRoles.isActive, true),
  ));
  const priority: Access["role"][] = ["Admin", "Accountant", "Approver", "Viewer"];
  const assigned = new Set(roles.map(({ role }) => role.toLowerCase()));
  const role = priority.find((candidate) => assigned.has(candidate.toLowerCase()));
  return role ? { role, permissions: ROLE_PERMISSIONS[role] } : null;
}

export function hasPermission(access: Access, permission: Permission) {
  return access.permissions.includes(permission);
}
