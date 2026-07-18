"use client";

import * as React from "react";

const MAX_KEYWORDS = 8;

type KeywordInputProps = {
  value: string[];
  onChange: (keywords: string[]) => void;
  error?: string;
  disabled?: boolean;
};

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function KeywordInput({
  value,
  onChange,
  error,
  disabled = false,
}: KeywordInputProps) {
  const [draft, setDraft] = React.useState("");

  function commitDraft() {
    const candidates = draft.split(",").map(normalizeKeyword).filter(Boolean);

    if (candidates.length === 0) {
      setDraft("");
      return;
    }

    const nextKeywords = [...value];

    for (const candidate of candidates) {
      const duplicate = nextKeywords.some(
        (keyword) =>
          keyword.toLocaleLowerCase() === candidate.toLocaleLowerCase(),
      );

      if (!duplicate && nextKeywords.length < MAX_KEYWORDS) {
        nextKeywords.push(candidate);
      }
    }

    onChange(nextKeywords);
    setDraft("");
  }

  function removeKeyword(keywordToRemove: string) {
    onChange(value.filter((keyword) => keyword !== keywordToRemove));
  }

  return (
    <div>
      <label
        htmlFor="keyword-input"
        className="block text-sm font-medium text-slate-700"
      >
        Keywords
      </label>

      <p className="mt-1 text-xs text-slate-500">
        Provide 3–8 scholarly keywords. Press Enter or use commas to add them.
      </p>

      {value.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
            >
              {keyword}

              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                disabled={disabled}
                aria-label={`Remove ${keyword}`}
                className="font-medium text-slate-500 hover:text-red-600 disabled:cursor-not-allowed"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          id="keyword-input"
          type="text"
          value={draft}
          maxLength={100}
          disabled={disabled || value.length >= MAX_KEYWORDS}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitDraft();
            }

            if (
              event.key === "Backspace" &&
              draft.length === 0 &&
              value.length > 0
            ) {
              removeKeyword(value[value.length - 1]);
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby="keyword-help"
          placeholder={
            value.length >= MAX_KEYWORDS
              ? "Maximum reached"
              : "e.g. semantic similarity"
          }
          className="block min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
        />

        <button
          type="button"
          onClick={commitDraft}
          disabled={
            disabled ||
            value.length >= MAX_KEYWORDS ||
            normalizeKeyword(draft).length === 0
          }
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div
        id="keyword-help"
        className="mt-2 flex justify-between gap-4 text-xs"
      >
        <span className={error ? "text-red-600" : "text-slate-500"}>
          {error ?? "These remain separate from AI-generated topic keywords."}
        </span>

        <span className="shrink-0 text-slate-500">
          {value.length}/{MAX_KEYWORDS}
        </span>
      </div>
    </div>
  );
}
