import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accessPolicies, masterData, userCompanyRoles } from "@/db/schema";

export type Permission = "read" | "create" | "post" | "approve" | "reconcile" | "close_period" | "review_ai" | "export" | "manage_master" | "manage_users" | "manage_settings" | "manage_integrations";
export type Access = { role: string; permissions: Permission[]; modules: string[] };
export const ALL_PERMISSIONS: Permission[] = ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master", "manage_users", "manage_settings", "manage_integrations"];

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Admin: ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master", "manage_users", "manage_settings", "manage_integrations"],
  SystemAdmin: ALL_PERMISSIONS,
  Accountant: ["read", "create", "post", "reconcile", "close_period", "review_ai", "export", "manage_master"],
  AccountingManager: ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master"],
  Approver: ["read", "approve", "review_ai"],
  APOfficer: ["read", "create", "export"],
  AROfficer: ["read", "create", "export"],
  Treasury: ["read", "create", "reconcile", "export"],
  TaxOfficer: ["read", "create", "post", "export"],
  Auditor: ["read", "export"],
  Executive: ["read", "approve", "review_ai", "export"],
  IntegrationAdmin: ["read", "reconcile", "manage_integrations"],
  Viewer: ["read"],
};

function safePermissions(value: unknown): Permission[] {
  return Array.isArray(value) ? value.filter((permission): permission is Permission => typeof permission === "string" && ALL_PERMISSIONS.includes(permission as Permission)) : [];
}

function safeModules(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((module): module is string => typeof module === "string" && /^[A-Z_]{2,30}$/.test(module)) : ["ALL"];
}

export async function getUserAccess(email: string): Promise<Access> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(masterData).where(and(eq(masterData.category, "USER"), sql`lower(${masterData.name}) = ${normalizedEmail}`, eq(masterData.status, "Active"))).limit(1);
  if (!user) return { role: "Viewer", permissions: ROLE_PERMISSIONS.Viewer, modules: ["ALL"] };
  let role = "Viewer";
  try {
    const value = JSON.parse(user.metadata) as { role?: string };
    if (value.role && ROLE_PERMISSIONS[value.role]) role = value.role;
  } catch { role = user.description.includes("Administrator") ? "Admin" : "Viewer"; }
  return { role, permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer, modules: ["ALL"] };
}

export async function getCompanyAccess(email: string, tenantId: string, companyId: string): Promise<Access | null> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const roles = await db.select({ role: userCompanyRoles.role, permissions: accessPolicies.permissions, modules: accessPolicies.moduleAccess }).from(userCompanyRoles)
    .leftJoin(accessPolicies, and(eq(accessPolicies.id, userCompanyRoles.accessPolicyId), eq(accessPolicies.status, "ACTIVE")))
    .where(and(
    eq(userCompanyRoles.tenantId, tenantId),
    eq(userCompanyRoles.companyId, companyId),
    sql`lower(${userCompanyRoles.userId}) = ${normalizedEmail}`,
    eq(userCompanyRoles.isActive, true),
  ));
  if (!roles.length) return null;
  const custom = roles.filter((assignment) => safePermissions(assignment.permissions).length > 0);
  if (custom.length) return {
    role: custom.map((assignment) => assignment.role).join(" + "),
    permissions: [...new Set(custom.flatMap((assignment) => safePermissions(assignment.permissions)))],
    modules: [...new Set(custom.flatMap((assignment) => safeModules(assignment.modules)))],
  };
  const priority = ["Admin", "SystemAdmin", "AccountingManager", "Accountant", "Approver", "Treasury", "TaxOfficer", "APOfficer", "AROfficer", "IntegrationAdmin", "Auditor", "Executive", "Viewer"];
  const role = priority.find((candidate) => roles.some((assignment) => assignment.role.toLowerCase() === candidate.toLowerCase())) || roles[0].role;
  return { role, permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer, modules: ["ALL"] };
}

export function hasPermission(access: Access, permission: Permission) {
  return access.permissions.includes(permission);
}

export function hasModuleAccess(access: Access, module: string) {
  return access.modules.includes("ALL") || access.modules.includes(module.toUpperCase());
}
