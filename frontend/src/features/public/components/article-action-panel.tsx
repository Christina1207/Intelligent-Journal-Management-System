"use client";

import { useState } from "react";
import type { PublicArticle } from "../types";
import { buildPlainTextCitation } from "../utils/article-details";

type ArticleActionPanelProps = {
  article: PublicArticle;
};

type CopyState = "idle" | "copied" | "failed";

export function ArticleActionPanel({ article }: ArticleActionPanelProps) {
  const [citationCopyState, setCitationCopyState] = useState<CopyState>("idle");
  const [linkCopyState, setLinkCopyState] = useState<CopyState>("idle");

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

  return (
    <aside className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Article Actions</h2>

      <div className="mt-5 grid gap-3">
        <a
          href={article.pdfUrl}
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Download PDF
        </a>

        <button
          type="button"
          onClick={copyCitation}
          className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
          className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {linkCopyState === "copied"
            ? "Link copied"
            : linkCopyState === "failed"
              ? "Could not copy"
              : "Copy Link"}
        </button>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-400"
          title="Citation export will be connected later."
        >
          Export BibTeX
        </button>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-400"
          title="Citation export will be connected later."
        >
          Export RIS
        </button>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Citation export will later connect to the public article export
        endpoints.
      </p>
    </aside>
  );
}
