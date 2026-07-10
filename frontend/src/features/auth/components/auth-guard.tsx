"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/types/auth";
import { useAuth } from "@/features/auth/hooks/use-auth";

type AuthGuardProps = {
  children: React.ReactNode;
  requiredRole?: UserRole;
};

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated, hasRole } = useAuth();

  React.useEffect(() => {
    if (isLoading || isAuthenticated) return;

    const query = searchParams.toString();
    const currentPath = query ? `${pathname}?${query}` : pathname;

    router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
  }, [isAuthenticated, isLoading, pathname, router, searchParams]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading account...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Access restricted
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This area is only available to users with the {requiredRole} role.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
