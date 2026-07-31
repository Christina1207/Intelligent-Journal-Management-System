import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { JournalInfo } from "@/features/public/types";
import { getJournalTheme } from "@/features/public/utils/journal-theme";

type ProtectedLayoutProps = {
  children: ReactNode;
  journal: JournalInfo | null;
};

export function ProtectedLayout({ children, journal }: ProtectedLayoutProps) {
  return (
    <div
      className="flex min-h-screen bg-background"
      style={getJournalTheme(journal)}
    >
      <AppSidebar journal={journal} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
