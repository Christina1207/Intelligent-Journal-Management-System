"use client"

import {
  Check,
  Copy,
  Download,
  FileCode2,
  LoaderCircle,
} from "lucide-react"
import { useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  getPublicArticleExportUrl,
  requestPublicArticleDownload,
} from "../api/public-api"
import type { PublicArticle } from "../types"

type ArticleActionPanelProps = {
  article: PublicArticle
}

type CopyState = "idle" | "copied" | "failed"
type DownloadState = "idle" | "loading" | "failed"

export function ArticleActionPanel({ article }: ArticleActionPanelProps) {
  const [linkCopyState, setLinkCopyState] = useState<CopyState>("idle")
  const [downloadState, setDownloadState] = useState<DownloadState>("idle")

  async function copyArticleLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopyState("copied")
    } catch {
      setLinkCopyState("failed")
    }

    window.setTimeout(() => setLinkCopyState("idle"), 1800)
  }

  async function downloadPdf() {
    if (downloadState === "loading") {
      return
    }

    setDownloadState("loading")

    try {
      const download = await requestPublicArticleDownload(article.slug)
      window.location.assign(download.download_url)
    } catch {
      setDownloadState("failed")
      window.setTimeout(() => setDownloadState("idle"), 3000)
    }
  }

  const exports = [
    {
      label: "BibTeX",
      href: getPublicArticleExportUrl(article.slug, "bibtex"),
      filename: `${article.slug}.bib`,
    },
    {
      label: "RIS",
      href: getPublicArticleExportUrl(article.slug, "ris"),
      filename: `${article.slug}.ris`,
    },
    {
      label: "Dublin Core",
      href: getPublicArticleExportUrl(article.slug, "dc"),
      filename: `${article.slug}.xml`,
    },
  ]

  return (
    <aside className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="font-sans text-base font-semibold text-foreground">
        Read and export
      </h2>

      <Button
        type="button"
        variant="accent"
        size="touch"
        className="mt-4 w-full"
        disabled={downloadState === "loading"}
        aria-busy={downloadState === "loading"}
        onClick={() => void downloadPdf()}
      >
        {downloadState === "loading" ? (
          <LoaderCircle
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden="true"
          />
        ) : (
          <Download data-icon="inline-start" aria-hidden="true" />
        )}
        {downloadState === "loading" ? "Preparing PDF…" : "Download PDF"}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="touch"
        className="mt-2 w-full"
        onClick={() => void copyArticleLink()}
      >
        {linkCopyState === "copied" ? (
          <Check data-icon="inline-start" aria-hidden="true" />
        ) : (
          <Copy data-icon="inline-start" aria-hidden="true" />
        )}
        {linkCopyState === "copied"
          ? "Link copied"
          : linkCopyState === "failed"
            ? "Could not copy"
            : "Copy article link"}
      </Button>

      <div className="mt-5 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <FileCode2 className="size-4" aria-hidden="true" />
          Export metadata
        </p>
        <div className="mt-3 grid gap-2">
          {exports.map((item) => (
            <a
              key={item.label}
              href={item.href}
              download={item.filename}
              className={cn(
                buttonVariants({ variant: "ghost", size: "touch" }),
                "justify-start"
              )}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {downloadState === "failed" ? (
        <p
          className="mt-4 text-xs leading-5 text-status-danger-foreground"
          role="alert"
        >
          The article PDF is currently unavailable. Please try again.
        </p>
      ) : null}
    </aside>
  )
}
