import type { ReactNode } from "react";

import { EditorialPortalLayout } from "@/components/layout/editorial-portal-layout";

export default function ReviewerLayout({ children }: { children: ReactNode }) {
  return (
    <EditorialPortalLayout role="REVIEWER">
      {children}
    </EditorialPortalLayout>
  );
}
