"use client";

import {
  BarChart3,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  LibraryBig,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import type { JournalInfo } from "@/features/public/types";
import {
  getCurrentUserStorageValue,
  parseStoredCurrentUser,
  subscribeToAuthStorage,
} from "@/lib/auth/auth-storage";
import {
  getNavigationItemsForRoles,
  type NavigationIcon,
} from "@/lib/auth/permissions";
import { APP_SHORT_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navigationIcons: Record<
  NavigationIcon,
  React.ComponentType<{ className?: string }>
> = {
  assignments: ClipboardList,
  dashboard: LayoutDashboard,
  intelligence: BarChart3,
  invitations: Inbox,
  publishing: LibraryBig,
  submissions: FileText,
};

type AppSidebarProps = {
  journal: JournalInfo | null;
};

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ journal }: AppSidebarProps) {
  const pathname = usePathname();

  const storedUser = React.useSyncExternalStore(
    subscribeToAuthStorage,
    getCurrentUserStorageValue,
    () => null,
  );

  const currentUser = React.useMemo(
    () => parseStoredCurrentUser(storedUser),
    [storedUser],
  );

  const roles = currentUser?.roles ?? [];
  const navigationItems = getNavigationItemsForRoles(roles);

  const shortName =
    journal?.shortName.trim() || journal?.name.trim() || APP_SHORT_NAME;

  const fullName = journal?.name.trim() || "Journal Manager";

  const mark = shortName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <aside className="hidden w-72 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
      <div className="flex h-16 items-center border-b px-5">
        <Link
          href="/dashboard"
          aria-label={`${fullName} dashboard`}
          className="flex min-w-0 items-center gap-2 font-semibold"
        >
          {journal?.logoUrl ? (
            <span className="flex size-8 shrink-0 overflow-hidden rounded-lg bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={journal.logoUrl}
                alt={`${shortName} logo`}
                className="size-full object-contain"
              />
            </span>
          ) : (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground"
              aria-hidden="true"
            >
              {mark}
            </span>
          )}

          <span className="truncate">{shortName}</span>
        </Link>
      </div>

      <nav className="space-y-1 p-3">
        {navigationItems.map((item) => {
          const Icon = navigationIcons[item.icon];
          const isActive = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
