import { FileCheck2, Upload } from "lucide-react";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/features/submissions/submission-formatters";

type ManuscriptFileFieldProps = {
  id: string;
  label: string;
  description: string;
  value: File | null;
  error?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
};

export function ManuscriptFileField({
  id,
  label,
  description,
  value,
  error,
  disabled,
  onChange,
}: ManuscriptFileFieldProps) {
  return (
    <FormField
      htmlFor={id}
      label={label}
      description={description}
      error={error}
      required
    >
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/45 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload className="size-4 text-accent" aria-hidden="true" />
          Choose a PDF
        </div>
        <Input
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={getFormFieldDescription({
            id,
            hasDescription: true,
            hasError: Boolean(error),
          })}
          className="mt-3 h-auto bg-background file:mr-3"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
        {value ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-background p-3 text-sm">
            <FileCheck2
              className="mt-0.5 size-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground" dir="auto">
                {value.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatFileSize(value.size)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </FormField>
  );
}
