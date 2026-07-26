"use client"

import * as React from "react"
import Link from "next/link"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  clearAuthData,
  getCurrentUserStorageValue,
  parseStoredCurrentUser,
  subscribeToAuthStorage,
} from "@/lib/auth/auth-storage"
import { ROLE_LABELS } from "@/lib/auth/roles"

export function AppHeader() {
  const storedUser = React.useSyncExternalStore(
    subscribeToAuthStorage,
    getCurrentUserStorageValue,
    () => null
  )
  const currentUser = React.useMemo(
    () => parseStoredCurrentUser(storedUser),
    [storedUser]
  )

  function handleLogout() {
    clearAuthData()
    window.location.assign("/login")
  }

  const roleLabel = currentUser?.roles[0]
    ? ROLE_LABELS[currentUser.roles[0]]
    : "Unauthenticated"

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <div>
        <p className="text-sm font-medium">Frontend foundation</p>
        <p className="text-xs text-muted-foreground">{roleLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
        >
          Dashboard
        </Link>
        <Button type="button" variant="outline" onClick={handleLogout}>
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
