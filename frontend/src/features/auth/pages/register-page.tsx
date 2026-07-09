import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"

export function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-md">
        <EmptyState
          title="Register"
          description="Registration UI will be added after user and role API behavior is finalized."
          action={
            <Link
              href="/login"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to login placeholder
            </Link>
          }
        />
      </div>
    </main>
  )
}
