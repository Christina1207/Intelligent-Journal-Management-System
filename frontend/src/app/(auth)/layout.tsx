import { AuthShell } from "@/features/auth/components/auth-shell";
import { getPublicJournalSafe } from "@/features/public/api/public-api";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const journal = await getPublicJournalSafe();

  return <AuthShell journal={journal}>{children}</AuthShell>;
}
