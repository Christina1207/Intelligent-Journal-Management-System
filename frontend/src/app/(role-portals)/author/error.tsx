"use client";

import { RotateCcw } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";

export default function AuthorAreaError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This author page could not be loaded"
      description="The problem may be temporary. Your submission data has not been changed."
      action={
        <Button type="button" variant="outline" size="touch" onClick={reset}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" />
          Try again
        </Button>
      }
    />
  );
}
