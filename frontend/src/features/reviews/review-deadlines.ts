export function toDateTimeLocal(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

export function deadlineAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(17, 0, 0, 0);

  return toDateTimeLocal(date);
}

export function validateReviewDeadlines(
  responseDeadline: string,
  reviewDeadline: string,
) {
  const responseDate = new Date(responseDeadline);
  const reviewDate = new Date(reviewDeadline);
  const now = new Date();

  if (
    Number.isNaN(responseDate.getTime()) ||
    Number.isNaN(reviewDate.getTime())
  ) {
    return {
      responseDeadline: "Provide a valid invitation response deadline.",
      reviewDeadline: "Provide a valid review submission deadline.",
    };
  }

  if (responseDate <= now) {
    return {
      responseDeadline:
        "The invitation response deadline must be in the future.",
    };
  }

  if (reviewDate <= responseDate) {
    return {
      reviewDeadline:
        "The review deadline must be later than the response deadline.",
    };
  }

  return {};
}
