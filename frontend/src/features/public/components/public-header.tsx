"use client"

import { useEffect, useState } from "react"
import { LogIn, Menu, PenLine, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { JournalInfo } from "../types"
import {
  publicPrimaryNavigation,
  submissionLoginHref,
} from "./public-navigation"

type PublicHeaderProps = {
  journal: JournalInfo | null
}

export function PublicHeader({ journal }: PublicHeaderProps) {
  const pathname = usePathname()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const shortName = journal?.shortName.trim() || journal?.name.trim() || "Journal"
  const fullName = journal?.name.trim() || "Scholarly publishing portal"
  const mark = shortName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase()

  useEffect(() => {
    if (!mobileNavigationOpen) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false)
      }
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [mobileNavigationOpen])

  function isCurrentRoute(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/90 bg-surface-elevated/95 backdrop-blur supports-[backdrop-filter]:bg-surface-elevated/90">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          aria-label={`${fullName} home`}
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary font-sans text-xs font-bold tracking-[0.12em] text-primary-foreground"
            aria-hidden="true"
          >
            {mark}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-lg leading-5 font-semibold text-foreground group-hover:text-accent">
              {shortName}
            </span>
            <span className="mt-0.5 hidden max-w-56 truncate text-[0.7rem] leading-4 text-muted-foreground sm:block xl:max-w-72">
              {fullName}
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {publicPrimaryNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrentRoute(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                isCurrentRoute(item.href) &&
                  "bg-secondary text-secondary-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-3">
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "touch" })}
          >
            <LogIn data-icon="inline-start" aria-hidden="true" />
            Login
          </Link>

          <Link
            href={submissionLoginHref}
            className={buttonVariants({ variant: "accent", size: "touch" })}
          >
            <PenLine data-icon="inline-start" aria-hidden="true" />
            Submit Manuscript
          </Link>
        </div>

        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-touch" }),
            "ml-auto lg:hidden"
          )}
          aria-expanded={mobileNavigationOpen}
          aria-controls="public-mobile-navigation"
          onClick={() => setMobileNavigationOpen((open) => !open)}
        >
          {mobileNavigationOpen ? (
            <X aria-hidden="true" />
          ) : (
            <Menu aria-hidden="true" />
          )}
          <span className="sr-only">
            {mobileNavigationOpen ? "Close navigation" : "Open navigation"}
          </span>
        </button>
      </div>

      {mobileNavigationOpen ? (
        <div
          id="public-mobile-navigation"
          className="border-t border-border bg-surface-elevated px-4 py-4 shadow-lg sm:px-6 lg:hidden"
        >
          <nav aria-label="Mobile navigation" className="mx-auto max-w-7xl">
            <ul className="grid gap-1">
              {publicPrimaryNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={
                      isCurrentRoute(item.href) ? "page" : undefined
                    }
                    onClick={() => setMobileNavigationOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-secondary hover:bg-muted hover:text-foreground",
                      isCurrentRoute(item.href) &&
                        "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:hidden">
              <Link
                href="/login"
                onClick={() => setMobileNavigationOpen(false)}
                className={buttonVariants({
                  variant: "outline",
                  size: "touch",
                })}
              >
                <LogIn data-icon="inline-start" aria-hidden="true" />
                Login
              </Link>
              <Link
                href={submissionLoginHref}
                onClick={() => setMobileNavigationOpen(false)}
                className={buttonVariants({
                  variant: "accent",
                  size: "touch",
                })}
              >
                <PenLine data-icon="inline-start" aria-hidden="true" />
                Submit Manuscript
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
