"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardCheck,
  FileOutput,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { APP_SHORT_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ManagerNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const managerNavigation: ManagerNavigationItem[] = [
  {
    label: "Dashboard",
    href: "/manager",
    icon: LayoutDashboard,
  },
  {
    label: "Initial Screening",
    href: "/manager/submissions",
    icon: ClipboardCheck,
  },
  {
    label: "Active Manuscripts",
    href: "/manager/monitoring",
    icon: Activity,
  },
  {
    label: "Publishing",
    href: "/manager/publishing",
    icon: FileOutput,
  },
];

function getDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username: string;
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.username;
}

function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/manager") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

function ManagerNavigation({
  className,
  mobile = false,
}: {
  className?: string;
  mobile?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Section Manager navigation"
      className={cn(
        mobile ? "grid grid-cols-2 gap-1 sm:grid-cols-4" : "space-y-1",
        className,
      )}
    >
      {managerNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = isNavigationItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex rounded-lg text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
              mobile
                ? "min-h-16 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-xs sm:text-sm"
                : "items-center gap-3 px-3 py-2.5",
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/manager"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold tracking-wide text-white"
            >
              {APP_SHORT_NAME.slice(0, 2)}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {APP_SHORT_NAME}
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                Editorial workspace
              </span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {user ? (
              <div className="min-w-0 text-right">
                <p className="max-w-28 truncate text-sm font-medium sm:max-w-56">
                  {getDisplayName(user)}
                </p>
                <p className="hidden text-xs text-slate-500 sm:block">
                  Section Manager account
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              aria-label="Log out of the Section Manager account"
              className="shrink-0"
            >
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="mx-auto max-w-7xl">
          <ManagerNavigation mobile />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Section management
            </p>

            <ManagerNavigation />
          </div>
        </aside>

        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
