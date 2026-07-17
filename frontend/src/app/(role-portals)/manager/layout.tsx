import * as React from "react";

import { ManagerShell } from "@/components/layout/manager-shell";
import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading Section Manager area...
        </div>
      }
    >
      <AuthGuard requiredRole="SECTION_MANAGER">
        <ManagerShell>{children}</ManagerShell>
      </AuthGuard>
    </React.Suspense>
  );
}
