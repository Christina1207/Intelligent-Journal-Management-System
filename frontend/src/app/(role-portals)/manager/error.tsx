"use client";

import { RefreshCw } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";

export default function ManagerError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="The Section Manager workspace encountered an error"
      description="Retry this page. If the problem continues, return to the Manager overview and try again."
      action={
        <Button type="button" variant="outline" onClick={unstable_retry}>
          <RefreshCw aria-hidden="true" />
          Retry page
        </Button>
      }
    />
  );
}
