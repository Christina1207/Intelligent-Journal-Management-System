"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";

export default function AuthorRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[author-route]", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Author workspace"
        title="This page could not be loaded"
        description="Your account session remains active. Retry the page when the journal service is available."
      />
      <ErrorState
        title="Author workspace unavailable"
        description="A temporary problem prevented this page from rendering."
        action={
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={unstable_retry}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    </div>
  );
}
