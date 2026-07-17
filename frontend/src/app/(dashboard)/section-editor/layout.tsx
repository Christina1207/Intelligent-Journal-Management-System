import { Suspense, type ReactNode } from "react";

import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function SectionEditorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Loading editorial workspace…
        </div>
      }
    >
      <AuthGuard requiredRole="SECTION_EDITOR">{children}</AuthGuard>
    </Suspense>
  );
}
