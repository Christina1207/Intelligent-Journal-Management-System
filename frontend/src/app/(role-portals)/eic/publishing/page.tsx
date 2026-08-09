import type { Metadata } from "next";

import { PublicationRecordsPage } from "@/features/publishing/components";

export const metadata: Metadata = {
  title: "Journal Publishing",
  description: "Manage publication drafts and published articles journal-wide.",
};

export default function EditorInChiefPublishingRoute() {
  return <PublicationRecordsPage basePath="/eic/publishing" journalWide />;
}
