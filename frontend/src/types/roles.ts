export const USER_ROLE = {
  AUTHOR: "AUTHOR",
  REVIEWER: "REVIEWER",
  EDITOR_IN_CHIEF: "EDITOR_IN_CHIEF",
  SECTION_MANAGER: "SECTION_MANAGER",
  SECTION_EDITOR: "SECTION_EDITOR",
  COPYEDITOR: "COPYEDITOR",
  ADMIN: "ADMIN",
  READER: "READER",
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const USER_ROLES = Object.values(USER_ROLE)

export const ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLE.AUTHOR]: "Author",
  [USER_ROLE.REVIEWER]: "Reviewer",
  [USER_ROLE.EDITOR_IN_CHIEF]: "Editor-in-Chief",
  [USER_ROLE.SECTION_MANAGER]: "Section Manager",
  [USER_ROLE.SECTION_EDITOR]: "Section Editor",
  [USER_ROLE.COPYEDITOR]: "Copyeditor",
  [USER_ROLE.ADMIN]: "Administrator",
  [USER_ROLE.READER]: "Reader",
}
