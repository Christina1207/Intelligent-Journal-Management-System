"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";

export default function PublicRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[public-route]", error);
  }, [error]);

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="This journal page could not be loaded"
          description="The journal service may be temporarily unavailable. Try the request again without losing your current route."
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
    </section>
  );
}
