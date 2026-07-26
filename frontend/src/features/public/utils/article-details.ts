export function formatArticleDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
}

export function getDoiHref(doi: string) {
  const normalizedDoi = doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

  return `https://doi.org/${encodeURI(normalizedDoi)}`;
}
