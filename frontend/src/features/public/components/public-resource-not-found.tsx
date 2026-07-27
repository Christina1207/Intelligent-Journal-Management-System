import { FileQuestion } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

interface PublicResourceNotFoundProps {
  eyebrow: string
  title: string
  description: string
  actionLabel: string
  actionHref: string
}

export function PublicResourceNotFound({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
}: PublicResourceNotFoundProps) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <FileQuestion className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-accent uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-text-secondary">
          {description}
        </p>
        <Link
          href={actionHref}
          className={buttonVariants({
            variant: "default",
            size: "touch",
            className: "mt-7",
          })}
        >
          {actionLabel}
        </Link>
      </div>
    </section>
  )
}
