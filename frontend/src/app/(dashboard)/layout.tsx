import type { ReactNode } from "react";

import { ProtectedLayout } from "@/components/layout/protected-layout";
import { getPublicJournalSafe } from "@/features/public/api/public-api";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const journal = await getPublicJournalSafe();

  return <ProtectedLayout journal={journal}>{children}</ProtectedLayout>;
}
