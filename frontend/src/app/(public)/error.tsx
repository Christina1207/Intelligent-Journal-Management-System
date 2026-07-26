"use client"

import { useEffect } from "react"
import { RotateCcw } from "lucide-react"

import { ErrorState } from "@/components/common/error-state"
import { Button } from "@/components/ui/button"

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Journal content could not be loaded"
          description="The journal service did not respond as expected. Try loading this page again."
          action={
            <Button type="button" variant="outline" size="touch" onClick={reset}>
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Try again
            </Button>
          }
        />
      </div>
    </section>
  )
}
