"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/hooks/use-auth";

const authorNavigation = [
  { label: "Dashboard", href: "/author" },
  { label: "My Submissions", href: "/author/submissions" },
  { label: "Submit Manuscript", href: "/author/submissions/new" },
  { label: "Profile", href: "/author/profile" },
];

function getDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username: string;
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.username;
}

export function AuthorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-semibold text-slate-950">
            IJMS
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-950">
                  {getDisplayName(user)}
                </p>
                <p className="text-xs text-slate-500">Author account</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="h-fit rounded-xl border bg-white p-3 shadow-sm">
          <nav aria-label="Author navigation" className="space-y-1">
            {authorNavigation.map((item) => {
              const isActive =
                item.href === "/author"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
