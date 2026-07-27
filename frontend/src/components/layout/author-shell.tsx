"use client";

import * as React from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

import { authorNavigation } from "./author-navigation";

function getDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username: string;
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.username;
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AU"
  );
}

function WorkspaceNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Author workspace navigation">
      <ul className="grid gap-1">
        {authorNavigation.map((item) => {
          const isActive = item.isActive(pathname);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/35",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4.5",
                    isActive ? "text-sidebar-primary" : "text-inherit",
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AuthorShell({
  children,
  journalName,
  journalShortName,
}: {
  children: React.ReactNode;
  journalName: string;
  journalShortName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileNavigationOpen, setMobileNavigationOpen] = React.useState(false);
  const displayName = user ? getDisplayName(user) : "Author";

  React.useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavigationOpen]);

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-3 focus:ring-ring/40"
      >
        Skip to main content
      </a>

      <aside className="hidden min-h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link
            href="/author"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/35"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-sans text-[0.65rem] font-bold tracking-[0.12em] text-sidebar-primary-foreground"
              aria-hidden="true"
            >
              {journalShortName
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 3)
                .toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-heading text-lg font-semibold text-white">
                {journalShortName}
              </span>
              <span className="mt-0.5 block text-xs text-sidebar-foreground/60">
                Author workspace
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-[0.68rem] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
            Workspace
          </p>
          <WorkspaceNavigation pathname={pathname} />
        </div>

        <div className="border-t border-sidebar-border p-4">
          <Link
            href="/author-guidelines"
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/35"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            Author guidelines
          </Link>
          <Link
            href="/"
            className="mt-1 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/35"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            View public journal
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-border/90 bg-surface-elevated/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="outline"
              size="icon-touch"
              className="lg:hidden"
              aria-expanded={mobileNavigationOpen}
              aria-controls="author-mobile-navigation"
              onClick={() => setMobileNavigationOpen((open) => !open)}
            >
              {mobileNavigationOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
              <span className="sr-only">
                {mobileNavigationOpen
                  ? "Close workspace navigation"
                  : "Open workspace navigation"}
              </span>
            </Button>

            <div className="min-w-0 lg:flex-1">
              <p className="truncate text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Author workspace
              </p>
              <p
                className="hidden truncate text-sm font-medium text-foreground sm:block"
                dir="auto"
              >
                {journalName}
              </p>
            </div>

            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "touch" }),
                "ml-auto hidden sm:inline-flex lg:ml-0",
              )}
            >
              <ExternalLink data-icon="inline-start" aria-hidden="true" />
              Journal
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "touch" }),
                  "max-w-56 gap-2 px-2.5",
                )}
                aria-label="Open author account menu"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  {getInitials(displayName)}
                </span>
                <span className="hidden max-w-28 truncate sm:block">
                  {displayName}
                </span>
                <ChevronDown
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-2">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {displayName}
                    </span>

                    {user?.email ? (
                      <span className="mt-0.5 block truncate font-normal text-muted-foreground">
                        {user.email}
                      </span>
                    ) : null}
                  </DropdownMenuLabel>

                  <DropdownMenuItem
                    className="min-h-10 px-2"
                    onClick={() => router.push("/author/profile")}
                  >
                    <UserRound aria-hidden="true" />
                    Profile
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="min-h-10 px-2"
                    onClick={() => router.push("/")}
                  >
                    <ExternalLink aria-hidden="true" />
                    Public journal
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-10 px-2"
                  onClick={handleLogout}
                >
                  <LogOut aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {mobileNavigationOpen ? (
            <div
              id="author-mobile-navigation"
              className="border-t border-border bg-sidebar px-4 py-4 text-sidebar-foreground shadow-lg lg:hidden"
            >
              <WorkspaceNavigation
                pathname={pathname}
                onNavigate={() => setMobileNavigationOpen(false)}
              />
              <div className="mt-4 grid gap-1 border-t border-sidebar-border pt-4">
                <Link
                  href="/author-guidelines"
                  onClick={() => setMobileNavigationOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Author guidelines
                </Link>
                <Link
                  href="/"
                  onClick={() => setMobileNavigationOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:hidden"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Public journal
                </Link>
              </div>
            </div>
          ) : null}
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
