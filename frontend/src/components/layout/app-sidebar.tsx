"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  LibraryBig,
} from "lucide-react"
import * as React from "react"

import {
  DASHBOARD_NAVIGATION_ITEMS,
  getNavigationItemsForRoles,
  type NavigationIcon,
} from "@/lib/auth/permissions"
import {
  getCurrentUserStorageValue,
  parseStoredCurrentUser,
  subscribeToAuthStorage,
} from "@/lib/auth/auth-storage"
import { APP_SHORT_NAME } from "@/lib/constants"
import { cn } from "@/lib/utils"

const navigationIcons: Record<
  NavigationIcon,
  React.ComponentType<{ className?: string }>
> = {
  assignments: ClipboardList,
  dashboard: LayoutDashboard,
  invitations: Inbox,
  publishing: LibraryBig,
  submissions: FileText,
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const storedUser = React.useSyncExternalStore(
    subscribeToAuthStorage,
    getCurrentUserStorageValue,
    () => null
  )
  const currentUser = React.useMemo(
    () => parseStoredCurrentUser(storedUser),
    [storedUser]
  )
  const roles = currentUser?.roles ?? []

  const navigationItems =
    roles.length > 0
      ? getNavigationItemsForRoles(roles)
      : DASHBOARD_NAVIGATION_ITEMS

  return (
    <aside className="hidden w-72 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            {APP_SHORT_NAME}
          </span>
          <span>Journal Manager</span>
        </Link>
      </div>
      <nav className="space-y-1 p-3">
        {navigationItems.map((item) => {
          const Icon = navigationIcons[item.icon]
          const isActive = isActiveRoute(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
