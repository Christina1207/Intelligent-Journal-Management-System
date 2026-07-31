import type { ReactNode } from "react";

import type { JournalInfo } from "../types";
import { getJournalTheme } from "../utils/journal-theme";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

interface PublicShellProps {
  journal: JournalInfo | null;
  children: ReactNode;
}

export function PublicShell({ journal, children }: PublicShellProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      style={getJournalTheme(journal)}
    >
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-3 focus:ring-ring/35"
      >
        Skip to main content
      </a>

      <PublicHeader journal={journal} />

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>

      <PublicFooter journal={journal} />
    </div>
  );
}
