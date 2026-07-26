"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    const nextKeywords = [...value];

    candidates.forEach((candidate) => {
      const isDuplicate = nextKeywords.some(
        (keyword) =>
          keyword.toLocaleLowerCase() === candidate.toLocaleLowerCase(),
      );

      if (!isDuplicate && nextKeywords.length < MAX_KEYWORDS) {
        nextKeywords.push(candidate);
      }
    });

    if (nextKeywords.length !== value.length) {
      onChange(nextKeywords);
    }

    setDraft("");
  }

  function removeKeyword(keywordToRemove: string) {
    onChange(value.filter((keyword) => keyword !== keywordToRemove));
  }

  return (
    <FormField
      htmlFor="keyword-input"
      label="Keywords"
      description="Provide 3–8 distinct scholarly keywords. Press Enter or type a comma to add each one."
      error={error}
      required
    >
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Added keywords">
          {value.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="h-auto gap-1 rounded-md py-1 pr-1 pl-2"
              dir="auto"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                disabled={disabled}
                aria-label={`Remove ${keyword}`}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
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
          aria-describedby={getFormFieldDescription({
            id: "keyword-input",
            hasDescription: true,
            hasError: Boolean(error),
          })}
          placeholder={
            value.length >= MAX_KEYWORDS
              ? "Maximum reached"
              : "e.g. semantic similarity"
          }
        />
        <Button
          type="button"
          variant="outline"
          size="touch"
          onClick={commitDraft}
          disabled={
            disabled ||
            value.length >= MAX_KEYWORDS ||
            normalizeKeyword(draft).length === 0
          }
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        {value.length}/{MAX_KEYWORDS}
      </p>
    </FormField>
  );
}
