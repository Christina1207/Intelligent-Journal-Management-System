const submissionDateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatSubmissionDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return submissionDateFormatter.format(date);
}

export function formatSubmissionLanguage(value: string) {
  const languageLabels: Record<string, string> = {
    ar: "Arabic",
    en: "English",
    fr: "French",
  };

  return languageLabels[value.toLowerCase()] ?? value;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
