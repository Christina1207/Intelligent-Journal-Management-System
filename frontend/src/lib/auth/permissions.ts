import { USER_ROLE, type UserRole } from "@/types/roles"

export type NavigationIcon =
  | "dashboard"
  | "submissions"
  | "assignments"
  | "invitations"
  | "publishing"

export interface NavigationItem {
  title: string
  href: string
  icon: NavigationIcon
  roles: readonly UserRole[]
}

export const DASHBOARD_NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    roles: [
      USER_ROLE.AUTHOR,
      USER_ROLE.REVIEWER,
      USER_ROLE.EDITOR_IN_CHIEF,
      USER_ROLE.SECTION_MANAGER,
      USER_ROLE.SECTION_EDITOR,
      USER_ROLE.COPYEDITOR,
      USER_ROLE.ADMIN,
      USER_ROLE.READER,
    ],
  },
  {
    title: "My Submissions",
    href: "/author/submissions",
    icon: "submissions",
    roles: [USER_ROLE.AUTHOR, USER_ROLE.ADMIN],
  },
  {
    title: "Managed Submissions",
    href: "/section-manager/submissions",
    icon: "submissions",
    roles: [
      USER_ROLE.SECTION_MANAGER,
      USER_ROLE.EDITOR_IN_CHIEF,
      USER_ROLE.ADMIN,
    ],
  },
  {
    title: "Editorial Assignments",
    href: "/section-editor/assignments",
    icon: "assignments",
    roles: [
      USER_ROLE.SECTION_EDITOR,
      USER_ROLE.EDITOR_IN_CHIEF,
      USER_ROLE.ADMIN,
    ],
  },
  {
    title: "Review Invitations",
    href: "/reviewer/invitations",
    icon: "invitations",
    roles: [USER_ROLE.REVIEWER, USER_ROLE.ADMIN],
  },
  {
    title: "Publishing Drafts",
    href: "/publishing/drafts",
    icon: "publishing",
    roles: [
      USER_ROLE.COPYEDITOR,
      USER_ROLE.EDITOR_IN_CHIEF,
      USER_ROLE.ADMIN,
    ],
  },
]

export function hasAnyRole(
  userRoles: readonly UserRole[],
  allowedRoles: readonly UserRole[]
) {
  return allowedRoles.some((role) => userRoles.includes(role))
}

export function getNavigationItemsForRoles(userRoles: readonly UserRole[]) {
  if (userRoles.length === 0) {
    return DASHBOARD_NAVIGATION_ITEMS
  }

  return DASHBOARD_NAVIGATION_ITEMS.filter((item) =>
    hasAnyRole(userRoles, item.roles)
  )
}
