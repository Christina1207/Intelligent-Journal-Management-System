import {
  FilePlus2,
  Files,
  LayoutDashboard,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type AuthorNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export const authorNavigation: AuthorNavigationItem[] = [
  {
    label: "Dashboard",
    href: "/author",
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === "/author",
  },
  {
    label: "My Submissions",
    href: "/author/submissions",
    icon: Files,
    isActive: (pathname) =>
      pathname === "/author/submissions" ||
      (pathname.startsWith("/author/submissions/") &&
        pathname !== "/author/submissions/new"),
  },
  {
    label: "New Submission",
    href: "/author/submissions/new",
    icon: FilePlus2,
    isActive: (pathname) => pathname === "/author/submissions/new",
  },
  {
    label: "Profile",
    href: "/author/profile",
    icon: UserRound,
    isActive: (pathname) => pathname.startsWith("/author/profile"),
  },
];
