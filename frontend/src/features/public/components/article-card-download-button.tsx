"use client"

import { Download, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

import { requestPublicArticleDownload } from "../api/public-api"

type DownloadState = "idle" | "loading" | "failed"

type ArticleCardDownloadButtonProps = {
  slug: string
}

export function ArticleCardDownloadButton({
  slug,
}: ArticleCardDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>("idle")

  async function handleDownload() {
    if (state === "loading") {
      return
    }

    setState("loading")

    try {
      const download = await requestPublicArticleDownload(slug)
      setState("idle")
      window.location.assign(download.download_url)
    } catch {
      setState("failed")
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="soft"
        size="touch"
        disabled={state === "loading"}
        aria-busy={state === "loading"}
        onClick={() => void handleDownload()}
      >
        {state === "loading" ? (
          <LoaderCircle
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden="true"
          />
        ) : (
          <Download data-icon="inline-start" aria-hidden="true" />
        )}
        {state === "loading"
          ? "Preparing…"
          : state === "failed"
            ? "Retry PDF"
            : "PDF"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "failed"
          ? "The PDF could not be prepared. Activate the button to retry."
          : ""}
      </span>
    </div>
  )
}
