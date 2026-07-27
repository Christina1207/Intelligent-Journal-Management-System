import { z } from "zod";

const optionalProfileText = (maximum: number, label: string) =>
  z
    .string()
    .trim()
    .max(maximum, `${label} must contain at most ${maximum} characters.`);

const orcidSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(value),
    "ORCID must use the format 0000-0000-0000-0000. The final character may be X.",
  );

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(1, "Enter your first name.")
      .max(150, "First name must contain at most 150 characters."),
    last_name: z
      .string()
      .trim()
      .min(1, "Enter your last name.")
      .max(150, "Last name must contain at most 150 characters."),
    username: z
      .string()
      .trim()
      .min(1, "Choose a username.")
      .max(150, "Username must contain at most 150 characters."),
    email: z
      .string()
      .trim()
      .min(1, "Enter your email address.")
      .email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters."),
    password_confirm: z.string().min(1, "Confirm your password."),
    orcid: orcidSchema,
    affiliation: optionalProfileText(255, "Affiliation"),
    country: optionalProfileText(100, "Country"),
  })
  .refine((values) => values.password === values.password_confirm, {
    message: "Passwords do not match.",
    path: ["password_confirm"],
  });

export const profileSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(150, "First name must contain at most 150 characters."),
  last_name: z
    .string()
    .trim()
    .min(1, "Enter your last name.")
    .max(150, "Last name must contain at most 150 characters."),
  orcid: orcidSchema,
  affiliation: optionalProfileText(255, "Affiliation"),
  country: optionalProfileText(100, "Country"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
