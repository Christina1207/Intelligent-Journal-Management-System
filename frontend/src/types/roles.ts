export const USER_ROLE = {
  AUTHOR: "AUTHOR",
  REVIEWER: "REVIEWER",
  EDITOR_IN_CHIEF: "EDITOR_IN_CHIEF",
  SECTION_MANAGER: "SECTION_MANAGER",
  SECTION_EDITOR: "SECTION_EDITOR",
  ADMIN: "ADMIN",
  READER: "READER",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const USER_ROLES = Object.values(USER_ROLE);

export const ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLE.AUTHOR]: "Author",
  [USER_ROLE.REVIEWER]: "Reviewer",
  [USER_ROLE.EDITOR_IN_CHIEF]: "Editor-in-Chief",
  [USER_ROLE.SECTION_MANAGER]: "Section Manager",
  [USER_ROLE.SECTION_EDITOR]: "Section Editor",
  [USER_ROLE.ADMIN]: "Administrator",
  [USER_ROLE.READER]: "Reader",
};

const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  [USER_ROLE.ADMIN]: "/dashboard",
  [USER_ROLE.EDITOR_IN_CHIEF]: "/dashboard",
  [USER_ROLE.SECTION_MANAGER]: "/manager",
  [USER_ROLE.SECTION_EDITOR]: "/section-editor/assignments",
  [USER_ROLE.REVIEWER]: "/reviewer/invitations",
  [USER_ROLE.AUTHOR]: "/author",
  [USER_ROLE.READER]: "/",
};

const ROLE_REDIRECT_PRIORITY: readonly UserRole[] = [
  USER_ROLE.ADMIN,
  USER_ROLE.EDITOR_IN_CHIEF,
  USER_ROLE.SECTION_MANAGER,
  USER_ROLE.SECTION_EDITOR,
  USER_ROLE.REVIEWER,
  USER_ROLE.AUTHOR,
  USER_ROLE.READER,
];

export function getDefaultRouteForRoles(roles: readonly UserRole[]) {
  const primaryRole = ROLE_REDIRECT_PRIORITY.find((role) =>
    roles.includes(role),
  );

  return primaryRole ? ROLE_HOME_ROUTES[primaryRole] : "/";
}
