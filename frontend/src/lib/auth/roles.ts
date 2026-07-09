import { USER_ROLES, type UserRole } from "@/types/roles"

export { ROLE_LABELS, USER_ROLE, USER_ROLES } from "@/types/roles"
export type { UserRole } from "@/types/roles"

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole)
}
