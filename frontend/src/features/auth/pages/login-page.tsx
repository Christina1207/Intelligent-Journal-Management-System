import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-md">
        <EmptyState
          title="Login"
          description="Authentication UI will be added after the backend auth contract is confirmed."
          action={
            <Link
              href="/register"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to registration placeholder
            </Link>
          }
        />
      </div>
    </main>
  )
}
