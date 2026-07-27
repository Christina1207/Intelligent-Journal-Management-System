import { z } from "zod";

export function parseExpertiseKeywords(value: string) {
  const normalizedKeywords: string[] = [];
  const seen = new Set<string>();

  for (const rawKeyword of value.split(/[,\n]/)) {
    const keyword = rawKeyword.trim().replace(/\s+/g, " ");

    if (!keyword) {
      continue;
    }

    const normalizedKey = keyword.toLocaleLowerCase();

    if (seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    normalizedKeywords.push(keyword);
  }

  return normalizedKeywords;
}

export const reviewerApplicationSchema = z.object({
  sectionId: z
    .string()
    .trim()
    .min(1, "Select the section you want to review for."),

  keywordsText: z
    .string()
    .trim()
    .refine(
      (value) => parseExpertiseKeywords(value).length >= 3,
      "Provide at least three distinct expertise keywords.",
    )
    .refine(
      (value) => parseExpertiseKeywords(value).length <= 20,
      "Provide at most twenty distinct expertise keywords.",
    )
    .refine(
      (value) =>
        parseExpertiseKeywords(value).every((keyword) => keyword.length <= 100),
      "Each expertise keyword must contain at most 100 characters.",
    ),

  biography: z
    .string()
    .trim()
    .min(50, "Academic biography must contain at least 50 characters.")
    .max(5000, "Academic biography must contain at most 5,000 characters."),
});

export type ReviewerApplicationFormValues = z.infer<
  typeof reviewerApplicationSchema
>;
