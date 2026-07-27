import type { EditorialWorkspaceRole } from "@/components/layout/editorial-navigation";
import { EditorialWorkspaceShell } from "@/components/layout/editorial-workspace-shell";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { getPublicJournalSafe } from "@/features/public/api/public-api";

type EditorialPortalLayoutProps = {
  children: React.ReactNode;
  role: EditorialWorkspaceRole;
};

export async function EditorialPortalLayout({
  children,
  role,
}: EditorialPortalLayoutProps) {
  const journal = await getPublicJournalSafe();
  const journalName = journal?.name.trim() || "Journal publishing portal";
  const journalShortName =
    journal?.shortName.trim() || journal?.name.trim() || "Journal";

  return (
    <AuthGuard requiredRole={role}>
      <EditorialWorkspaceShell
        journalName={journalName}
        journalShortName={journalShortName}
        role={role}
      >
        {children}
      </EditorialWorkspaceShell>
    </AuthGuard>
  );
}
