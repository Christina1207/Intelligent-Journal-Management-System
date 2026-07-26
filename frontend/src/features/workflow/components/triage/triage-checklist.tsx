import { Textarea } from "@/components/ui/textarea";
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
              "rounded-xl border bg-white p-5 shadow-sm",
              check.result === "CONCERN"
                ? "border-amber-300"
                : "border-slate-200",
            )}
          >
            <legend className="sr-only">{check.label}</legend>

            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                {index + 1}
              </span>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-950">
                    {check.label}
                  </h3>

                  {check.required ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Required
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm leading-6 text-slate-600">
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
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition",
                      "has-disabled:cursor-not-allowed has-disabled:opacity-60",
                      selected &&
                        option.value === "PASS" &&
                        "border-emerald-300 bg-emerald-50",
                      selected &&
                        option.value === "CONCERN" &&
                        "border-amber-300 bg-amber-50",
                      selected &&
                        option.value === "NOT_APPLICABLE" &&
                        "border-slate-400 bg-slate-50",
                      !selected && "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`triage-${check.code}`}
                      value={option.value}
                      checked={selected}
                      onChange={() =>
                        updateCheck(check.code, {
                          result: option.value,
                        })
                      }
                      className="mt-0.5 size-4 accent-slate-950"
                    />

                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
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
                className="text-sm font-medium text-slate-700"
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
              />
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
