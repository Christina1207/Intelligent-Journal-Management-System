import type { Metadata } from "next";

import { IssueManagementPage } from "@/features/publishing/components";

export const metadata: Metadata = {
  title: "Issue Management",
  description: "Manage the continuous-publication issue lifecycle.",
};

export default function EditorInChiefIssuesRoute() {
  return <IssueManagementPage />;
}
