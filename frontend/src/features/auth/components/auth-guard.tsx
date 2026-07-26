"use client";

import * as React from "react";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { UserRole } from "@/types/auth";
import { ROLE_LABELS } from "@/types/roles";

type AuthGuardProps = {
  children: React.ReactNode;
  requiredRole?: UserRole;
};

function AccountLoadingState({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      role="status"
      aria-label={label}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-52 max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, hasRole, logout } = useAuth();

  React.useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    const currentPath = `${pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return <AccountLoadingState label="Checking your account" />;
  }

  if (!user) {
    return <AccountLoadingState label="Redirecting to login" />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <section className="w-full max-w-lg rounded-xl border border-border bg-card p-7 text-center shadow-xs sm:p-9">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-action-subtle text-status-action-foreground">
            <LockKeyhole aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold text-foreground">
            This workspace is restricted
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Your account does not currently have the{" "}
            {ROLE_LABELS[requiredRole]} role required for this area.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              Return to journal
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className={buttonVariants({ variant: "default", size: "touch" })}
            >
              Sign in with another account
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
