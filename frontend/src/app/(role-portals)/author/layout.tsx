import { AuthorShell } from "@/components/layout/author-shell";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { getPublicJournalSafe } from "@/features/public/api/public-api";

export default async function AuthorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const journal = await getPublicJournalSafe();
  const journalName = journal?.name.trim() || "Journal publishing portal";
  const journalShortName =
    journal?.shortName.trim() || journal?.name.trim() || "Journal";

  return (
    <AuthGuard requiredRole="AUTHOR">
      <AuthorShell
        journalName={journalName}
        journalShortName={journalShortName}
      >
        {children}
      </AuthorShell>
    </AuthGuard>
  );
}
