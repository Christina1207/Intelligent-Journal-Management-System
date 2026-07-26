"use client";

import { useState } from "react";

import { requestPublicArticleDownload } from "../api/public-api";

type DownloadState = "idle" | "loading" | "failed";

type ArticleCardDownloadButtonProps = {
  slug: string;
};

export function ArticleCardDownloadButton({
  slug,
}: ArticleCardDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>("idle");

  async function handleDownload() {
    if (state === "loading") {
      return;
    }

    setState("loading");

    try {
      const download = await requestPublicArticleDownload(slug);

      setState("idle");
      window.location.assign(download.download_url);
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      disabled={state === "loading"}
      aria-busy={state === "loading"}
      onClick={() => {
        void handleDownload();
      }}
      className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
    >
      {state === "loading"
        ? "Preparing PDF..."
        : state === "failed"
          ? "Retry download"
          : "Download PDF"}
    </button>
  );
}
