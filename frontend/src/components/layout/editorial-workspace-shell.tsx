"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import {
  EDITORIAL_WORKSPACES,
  isEditorialNavigationItemActive,
  type EditorialWorkspaceRole,
} from "@/components/layout/editorial-navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

type EditorialWorkspaceShellProps = {
  children: React.ReactNode;
  journalName: string;
  journalShortName: string;
  role: EditorialWorkspaceRole;
};

function JournalMark({ shortName }: { shortName: string }) {
  const mark =
    shortName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 4)
      .toUpperCase() || "J";

  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar-primary font-serif text-sm font-semibold tracking-[0.08em] text-sidebar-primary-foreground"
    >
      {mark}
    </span>
  );
}

function WorkspaceNavigation({
  mobile = false,
  onNavigate,
  role,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  role: EditorialWorkspaceRole;
}) {
  const pathname = usePathname();
  const workspace = EDITORIAL_WORKSPACES[role];

  return (
    <nav aria-label={`${workspace.shortLabel} navigation`}>
      <ul className={cn("space-y-1", mobile && "grid gap-1 sm:grid-cols-2")}>
        {workspace.navigation.map((item) => {
          const active = isEditorialNavigationItemActive(
            pathname,
            item,
            workspace.homeHref,
          );
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/78 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function EditorialWorkspaceShell({
  children,
  journalName,
  journalShortName,
  role,
}: EditorialWorkspaceShellProps) {
  const router = useRouter();
  const mobileNavigationId = useId();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const { logout, user } = useAuth();
  const workspace = EDITORIAL_WORKSPACES[role];
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    workspace.shortLabel;

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavigationOpen]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <Link
          href={workspace.homeHref}
          className="flex min-h-20 items-center gap-3 border-b border-sidebar-border px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring"
        >
          <JournalMark shortName={journalShortName} />
          <span className="min-w-0">
            <span className="block truncate font-serif text-base font-semibold">
              {journalShortName}
            </span>
            <span className="mt-0.5 block text-xs text-sidebar-foreground/65">
              {workspace.shortLabel}
            </span>
          </span>
        </Link>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <WorkspaceNavigation role={role} />
        </div>

        <div className="border-t border-sidebar-border px-6 py-4 text-xs leading-5 text-sidebar-foreground/60">
          Editorial decisions remain human-led and auditable.
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/88">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="outline"
              size="icon-touch"
              className="size-11 lg:hidden"
              aria-label={
                mobileNavigationOpen ? "Close navigation" : "Open navigation"
              }
              aria-controls={mobileNavigationId}
              aria-expanded={mobileNavigationOpen}
              onClick={() => setMobileNavigationOpen((open) => !open)}
            >
              {mobileNavigationOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </Button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {workspace.label}
              </p>
              <p className="truncate font-serif text-sm font-semibold sm:text-base">
                {journalName}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "touch" }),
                  "min-w-0 max-w-52 gap-2 px-2 sm:px-3",
                )}
                aria-label="Open account menu"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block truncate text-sm font-medium">
                    {displayName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {workspace.shortLabel}
                  </span>
                </span>
                <ChevronDown
                  className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate font-medium">{displayName}</span>
                  {user?.email ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => router.push("/")}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Public journal
                  <ExternalLink
                    className="ml-auto size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  variant="destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div
            id={mobileNavigationId}
            hidden={!mobileNavigationOpen}
            className="border-t border-border bg-card px-4 py-4 shadow-sm lg:hidden"
          >
            <WorkspaceNavigation
              mobile
              role={role}
              onNavigate={() => setMobileNavigationOpen(false)}
            />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[100rem] px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
