import { USER_ROLE, type UserRole } from "@/types/roles";

export type NavigationIcon =
  | "dashboard"
  | "submissions"
  | "assignments"
  | "invitations"
  | "publishing"
  | "intelligence";

export interface NavigationItem {
  title: string;
  href: string;
  icon: NavigationIcon;
  roles: readonly UserRole[];
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
    href: "/manager/submissions",
    icon: "submissions",
    roles: [USER_ROLE.SECTION_MANAGER],
  },
  {
    title: "Section Intelligence",
    href: "/manager/intelligence",
    icon: "intelligence",
    roles: [USER_ROLE.SECTION_MANAGER],
  },
  {
    title: "Editorial Assignments",
    href: "/section-editor/assignments",
    icon: "assignments",
    roles: [USER_ROLE.SECTION_EDITOR],
  },
  {
    title: "Review Invitations",
    href: "/reviewer/invitations",
    icon: "invitations",
    roles: [USER_ROLE.REVIEWER],
  },
  {
    title: "Publishing Drafts",
    href: "/publishing/drafts",
    icon: "publishing",
    roles: [USER_ROLE.EDITOR_IN_CHIEF, USER_ROLE.ADMIN],
  },
];

export function hasAnyRole(
  userRoles: readonly UserRole[],
  allowedRoles: readonly UserRole[],
) {
  return allowedRoles.some((role) => userRoles.includes(role));
}

export function getNavigationItemsForRoles(userRoles: readonly UserRole[]) {
  if (userRoles.length === 0) {
    return [];
  }

  return DASHBOARD_NAVIGATION_ITEMS.filter((item) =>
    hasAnyRole(userRoles, item.roles),
  );
}
