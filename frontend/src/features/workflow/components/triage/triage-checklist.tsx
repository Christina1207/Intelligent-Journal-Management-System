import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { TriageCheck, TriageResult } from "@/features/workflow/types";
import { cn } from "@/lib/utils";

const resultOptions: Array<{
  value: TriageResult;
  label: string;
  description: string;
}> = [
  {
    value: "PASS",
    label: "Pass",
    description: "No issue identified.",
  },
  {
    value: "CONCERN",
    label: "Concern",
    description: "Requires resolution or desk rejection.",
  },
  {
    value: "NOT_APPLICABLE",
    label: "Not applicable",
    description: "This check does not apply.",
  },
];

export function TriageChecklist({
  checks,
  disabled,
  onChange,
}: {
  checks: TriageCheck[];
  disabled: boolean;
  onChange: (checks: TriageCheck[]) => void;
}) {
  function updateCheck(
    code: string,
    changes: Partial<Pick<TriageCheck, "result" | "note">>,
  ) {
    onChange(
      checks.map((check) =>
        check.code === code ? { ...check, ...changes } : check,
      ),
    );
  }

  return (
    <div className="space-y-4">
      {checks.map((check, index) => {
        const availableOptions = resultOptions.filter(
          (option) =>
            option.value !== "NOT_APPLICABLE" || check.allow_not_applicable,
        );

        return (
          <fieldset
            key={check.code}
            disabled={disabled}
            className={cn(
              "rounded-xl border bg-card p-5 shadow-xs",
              check.result === "CONCERN"
                ? "border-status-action-border"
                : "border-border/80",
            )}
          >
            <legend className="sr-only">{check.label}</legend>

            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {index + 1}
              </span>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading font-semibold text-foreground">
                    {check.label}
                  </h3>

                  {check.required ? (
                    <Badge variant="outline">
                      Required
                    </Badge>
                  ) : null}
                </div>

                <p
                  id={`${check.code}-description`}
                  className="mt-1 text-sm leading-6 text-text-secondary"
                >
                  {check.description}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {availableOptions.map((option) => {
                const inputId = `${check.code}-${option.value}`;
                const selected = check.result === option.value;

                return (
                  <label
                    key={option.value}
                    htmlFor={inputId}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-start gap-2 rounded-lg border p-3 transition",
                      "has-disabled:cursor-not-allowed has-disabled:opacity-60",
                      selected &&
                        option.value === "PASS" &&
                        "border-status-success-border bg-status-success-subtle",
                      selected &&
                        option.value === "CONCERN" &&
                        "border-status-action-border bg-status-action-subtle",
                      selected &&
                        option.value === "NOT_APPLICABLE" &&
                        "border-border bg-muted/50",
                      !selected && "border-border/80 hover:bg-muted/35",
                    )}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`triage-${check.code}`}
                      value={option.value}
                      checked={selected}
                      aria-describedby={`${check.code}-description`}
                      onChange={() =>
                        updateCheck(check.code, {
                          result: option.value,
                        })
                      }
                      className="mt-0.5 size-4 accent-primary"
                    />

                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4">
              <label
                htmlFor={`${check.code}-note`}
                className="text-sm font-medium text-foreground"
              >
                Item note
              </label>

              <Textarea
                id={`${check.code}-note`}
                value={check.note}
                maxLength={2000}
                disabled={disabled}
                onChange={(event) =>
                  updateCheck(check.code, {
                    note: event.target.value,
                  })
                }
                placeholder={
                  check.result === "CONCERN"
                    ? "Describe the concern and why it requires attention."
                    : "Optional internal note for this checklist item."
                }
                className="mt-2 min-h-20"
                dir="auto"
              />
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
