import * as React from "react";

import { AuthorShell } from "@/components/layout/author-shell";
import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function AuthorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading author area...
        </div>
      }
    >
      <AuthGuard requiredRole="AUTHOR">
        <AuthorShell>{children}</AuthorShell>
      </AuthGuard>
    </React.Suspense>
  );
}
