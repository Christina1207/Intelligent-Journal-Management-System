import * as React from "react";

import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function ReviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
          Loading reviewer workspace...
        </div>
      }
    >
      <AuthGuard requiredRole="REVIEWER">{children}</AuthGuard>
    </React.Suspense>
  );
}
