import { getPublicJournalSafe } from "@/features/public/api/public-api"
import { PublicShell } from "@/features/public/components/public-shell"

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const journal = await getPublicJournalSafe()

  return <PublicShell journal={journal}>{children}</PublicShell>
}
