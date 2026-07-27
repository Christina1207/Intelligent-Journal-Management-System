import { z } from "zod";

import { manuscriptFileSchema } from "@/features/submissions/new-submission-schema";

export const revisionUploadSchema = z.object({
  file: manuscriptFileSchema("full revised manuscript"),
  blinded_file: manuscriptFileSchema("blinded revised manuscript"),
  response_to_reviewers: z
    .string()
    .trim()
    .min(20, "Your point-by-point response must contain at least 20 characters.")
    .max(20_000, "Your response must contain at most 20,000 characters."),
});

export type RevisionUploadFormValues = z.infer<typeof revisionUploadSchema>;
