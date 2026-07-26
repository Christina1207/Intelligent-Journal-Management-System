"use client";

import { useState } from "react";

import {
  getPublicArticleExportUrl,
  requestPublicArticleDownload,
} from "../api/public-api";
import type { PublicArticle } from "../types";
import { buildPlainTextCitation } from "../utils/article-details";

type ArticleActionPanelProps = {
  article: PublicArticle;
};

type CopyState = "idle" | "copied" | "failed";
type DownloadState = "idle" | "loading" | "failed";

const secondaryActionStyles =
  "rounded-lg border px-4 py-2.5 text-center text-sm font-semibold " +
  "text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2";

export function ArticleActionPanel({ article }: ArticleActionPanelProps) {
  const [citationCopyState, setCitationCopyState] = useState<CopyState>("idle");
  const [linkCopyState, setLinkCopyState] = useState<CopyState>("idle");
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");

  async function copyText(text: string, onChange: (state: CopyState) => void) {
    try {
      await navigator.clipboard.writeText(text);
      onChange("copied");

      window.setTimeout(() => {
        onChange("idle");
      }, 1800);
    } catch {
      onChange("failed");

      window.setTimeout(() => {
        onChange("idle");
      }, 1800);
    }
  }

  function copyCitation() {
    void copyText(buildPlainTextCitation(article), setCitationCopyState);
  }

  function copyArticleLink() {
    void copyText(window.location.href, setLinkCopyState);
  }

  async function downloadPdf() {
    if (downloadState === "loading") {
      return;
    }

    setDownloadState("loading");

    try {
      const download = await requestPublicArticleDownload(article.slug);

      /*
       * Navigation occurs only after the backend confirms that the
       * article is published and returns its temporary storage URL.
       */
      window.location.assign(download.download_url);
    } catch {
      setDownloadState("failed");

      window.setTimeout(() => {
        setDownloadState("idle");
      }, 3000);
    }
  }

  const bibtexUrl = getPublicArticleExportUrl(article.slug, "bibtex");
  const risUrl = getPublicArticleExportUrl(article.slug, "ris");
  const dublinCoreUrl = getPublicArticleExportUrl(article.slug, "dc");

  return (
    <aside className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Article Actions</h2>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          disabled={downloadState === "loading"}
          aria-busy={downloadState === "loading"}
          onClick={() => {
            void downloadPdf();
          }}
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
        >
          {downloadState === "loading" ? "Preparing PDF..." : "Download PDF"}
        </button>

        <button
          type="button"
          onClick={copyCitation}
          className={secondaryActionStyles}
        >
          {citationCopyState === "copied"
            ? "Citation copied"
            : citationCopyState === "failed"
              ? "Could not copy"
              : "Copy Citation"}
        </button>

        <button
          type="button"
          onClick={copyArticleLink}
          className={secondaryActionStyles}
        >
          {linkCopyState === "copied"
            ? "Link copied"
            : linkCopyState === "failed"
              ? "Could not copy"
              : "Copy Link"}
        </button>

        <a
          href={bibtexUrl}
          download={`${article.slug}.bib`}
          className={secondaryActionStyles}
        >
          Export BibTeX
        </a>

        <a
          href={risUrl}
          download={`${article.slug}.ris`}
          className={secondaryActionStyles}
        >
          Export RIS
        </a>

        <a
          href={dublinCoreUrl}
          download={`${article.slug}.xml`}
          className={secondaryActionStyles}
        >
          Export Dublin Core
        </a>
      </div>

      <p
        role={downloadState === "failed" ? "alert" : "status"}
        aria-live="polite"
        className={
          downloadState === "failed"
            ? "mt-4 text-xs leading-5 text-red-700"
            : "sr-only"
        }
      >
        {downloadState === "failed"
          ? "The article PDF is currently unavailable. Please try again."
          : ""}
      </p>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Citation files use the article metadata preserved at publication time.
      </p>
    </aside>
  );
}
