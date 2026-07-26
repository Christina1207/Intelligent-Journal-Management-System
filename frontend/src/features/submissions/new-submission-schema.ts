import { z } from "zod";

export const MAX_MANUSCRIPT_FILE_SIZE = 50 * 1024 * 1024;

const orcidSchema = z
  .string()
  .trim()
  .max(19, "ORCID must contain at most 19 characters.")
  .refine(
    (value) => !value || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(value),
    "ORCID must use the format 0000-0000-0000-0000.",
  );

export const manuscriptFileSchema = (label: string) =>
  z
    .custom<File | null>(
      (value) => typeof File !== "undefined" && value instanceof File,
      `Choose the ${label} PDF.`,
    )
    .superRefine((file, context) => {
      if (!file) {
        return;
      }

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLocaleLowerCase().endsWith(".pdf");

      if (!isPdf) {
        context.addIssue({
          code: "custom",
          message: "Only PDF files are accepted.",
        });
      }

      if (file.size > MAX_MANUSCRIPT_FILE_SIZE) {
        context.addIssue({
          code: "custom",
          message: `${label} must be 50 MB or smaller.`,
        });
      }
    });

const coauthorSchema = z.object({
  clientId: z.string(),
  full_name: z
    .string()
    .trim()
    .min(1, "Enter each co-author's full name.")
    .max(255, "A co-author name must contain at most 255 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Enter each co-author's email address.")
    .email("Enter a valid co-author email address."),
  affiliation: z
    .string()
    .trim()
    .max(255, "Affiliation must contain at most 255 characters."),
  orcid: orcidSchema,
  country: z
    .string()
    .trim()
    .max(100, "Country must contain at most 100 characters."),
});

const confirmationSchema = (message: string) =>
  z.boolean().refine(Boolean, message);

export function createNewSubmissionSchema(primaryAuthorEmail?: string) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Enter the manuscript title.")
        .max(500, "Title must contain at most 500 characters."),
      abstract: z.string().trim().min(1, "Enter the manuscript abstract."),
      keywords: z
        .array(
          z
            .string()
            .trim()
            .min(1)
            .max(100, "Each keyword must contain at most 100 characters."),
        )
        .min(3, "Provide at least 3 distinct keywords.")
        .max(8, "Provide no more than 8 keywords.")
        .superRefine((keywords, context) => {
          const normalized = keywords.map((keyword) =>
            keyword.toLocaleLowerCase(),
          );

          if (new Set(normalized).size !== normalized.length) {
            context.addIssue({
              code: "custom",
              message: "Keywords must be distinct.",
            });
          }
        }),
      language: z.enum(["en", "ar", "fr"], {
        error: "Choose English, Arabic, or French.",
      }),
      section: z.string().trim().min(1, "Choose an active journal section."),
      cover_letter: z.string(),
      coauthors: z.array(coauthorSchema).max(20, "Add no more than 20 co-authors."),
      file: manuscriptFileSchema("full manuscript"),
      blinded_file: manuscriptFileSchema("blinded manuscript"),
      confirm_original: confirmationSchema(
        "Confirm the manuscript is not published or under review elsewhere.",
      ),
      confirm_authors: confirmationSchema(
        "Confirm that all authors approved this submission.",
      ),
      confirm_guidelines: confirmationSchema(
        "Confirm that the manuscript follows the author guidelines.",
      ),
      confirm_files: confirmationSchema(
        "Confirm that both uploaded files are the correct versions.",
      ),
      confirm_workflow: confirmationSchema(
        "Confirm that the manuscript should enter the editorial workflow.",
      ),
    })
    .superRefine((values, context) => {
      const normalizedPrimaryEmail = primaryAuthorEmail
        ?.trim()
        .toLocaleLowerCase();
      const seenEmails = new Set<string>();

      values.coauthors.forEach((coauthor, index) => {
        const normalizedEmail = coauthor.email.trim().toLocaleLowerCase();

        if (
          normalizedPrimaryEmail &&
          normalizedEmail === normalizedPrimaryEmail
        ) {
          context.addIssue({
            code: "custom",
            path: ["coauthors", index, "email"],
            message:
              "The submitting author must not be repeated as a co-author.",
          });
        }

        if (seenEmails.has(normalizedEmail)) {
          context.addIssue({
            code: "custom",
            path: ["coauthors", index, "email"],
            message: "Each co-author email address must be distinct.",
          });
        }

        seenEmails.add(normalizedEmail);
      });
    });
}

export type NewSubmissionFormValues = z.infer<
  ReturnType<typeof createNewSubmissionSchema>
>;
