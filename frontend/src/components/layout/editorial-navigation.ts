import {
  BarChart3,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  Library,
  Send,
  UserRoundCheck,
} from "lucide-react";

import type { UserRole } from "@/types/roles";

export type EditorialWorkspaceRole = Extract<
  UserRole,
  "EDITOR_IN_CHIEF" | "SECTION_MANAGER" | "SECTION_EDITOR" | "REVIEWER"
>;

export type EditorialNavigationItem = {
  activePrefixes?: string[];
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type EditorialWorkspaceConfig = {
  label: string;
  shortLabel: string;
  homeHref: string;
  navigation: EditorialNavigationItem[];
};

export const EDITORIAL_WORKSPACES: Record<
  EditorialWorkspaceRole,
  EditorialWorkspaceConfig
> = {
  EDITOR_IN_CHIEF: {
    label: "Editor-in-Chief Workspace",
    shortLabel: "Editor-in-Chief",
    homeHref: "/eic",
    navigation: [
      {
        href: "/eic",
        label: "Overview",
        icon: LayoutDashboard,
      },
      {
        href: "/eic/issues",
        label: "Issues",
        icon: Library,
      },
    ],
  },
  SECTION_MANAGER: {
    label: "Section Manager Workspace",
    shortLabel: "Section Manager",
    homeHref: "/manager",
    navigation: [
      {
        href: "/manager",
        label: "Overview",
        icon: LayoutDashboard,
      },
      {
        href: "/manager/submissions",
        label: "Initial screening",
        icon: FileSearch,
      },
      {
        href: "/manager/reviewer-applications",
        label: "Reviewer applications",
        icon: UserRoundCheck,
      },
      {
        href: "/manager/monitoring",
        label: "Active manuscripts",
        icon: ClipboardCheck,
      },
      {
        href: "/manager/intelligence",
        label: "Section intelligence",
        icon: BarChart3,
      },
      {
        href: "/manager/publishing",
        label: "Publishing",
        icon: Library,
      },
    ],
  },
  SECTION_EDITOR: {
    label: "Section Editor Workspace",
    shortLabel: "Section Editor",
    homeHref: "/section-editor/assignments",
    navigation: [
      {
        activePrefixes: ["/section-editor"],
        href: "/section-editor/assignments",
        label: "Assignments",
        icon: ClipboardCheck,
      },
    ],
  },
  REVIEWER: {
    label: "Reviewer Workspace",
    shortLabel: "Reviewer",
    homeHref: "/reviewer/invitations",
    navigation: [
      {
        activePrefixes: ["/reviewer"],
        href: "/reviewer/invitations",
        label: "Review workspace",
        icon: Send,
      },
    ],
  },
};

export function isEditorialNavigationItemActive(
  pathname: string,
  item: EditorialNavigationItem,
  homeHref: string,
) {
  if (
    item.activePrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  const { href } = item;

  if (href === homeHref) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
