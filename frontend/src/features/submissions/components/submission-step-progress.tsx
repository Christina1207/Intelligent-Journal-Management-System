import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const submissionSteps = [
  "Manuscript details",
  "Authors",
  "Files",
  "Review and submit",
] as const;

type SubmissionStepProgressProps = {
  currentStep: number;
};

export function SubmissionStepProgress({
  currentStep,
}: SubmissionStepProgressProps) {
  return (
    <nav aria-label="Submission progress">
      <ol className="grid grid-cols-4 gap-1">
        {submissionSteps.map((step, index) => {
          const isCurrent = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className="min-w-0"
            >
              <div
                className={cn(
                  "h-1.5 rounded-full bg-muted",
                  (isCurrent || isComplete) && "bg-accent",
                )}
              />
              <div className="mt-2 flex items-start gap-1.5">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[0.65rem] font-semibold text-muted-foreground",
                    isCurrent &&
                      "border-accent bg-accent text-accent-foreground",
                    isComplete &&
                      "border-status-success-border bg-status-success-subtle text-status-success-foreground",
                  )}
                  aria-hidden="true"
                >
                  {isComplete ? <Check className="size-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs leading-5 text-muted-foreground sm:block",
                    isCurrent && "font-semibold text-foreground",
                  )}
                >
                  {step}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm font-medium text-foreground sm:hidden">
        Step {currentStep + 1} of {submissionSteps.length}:{" "}
        {submissionSteps[currentStep]}
      </p>
    </nav>
  );
}
