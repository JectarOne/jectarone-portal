import { z } from "zod";
import { ROLES } from "./rbac";
import { ASSESSMENT_TYPES, ASSESSMENT_STATUSES } from "./assessments";

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional()
  );

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.date().optional()
);

export const assessmentSchema = z
  .object({
    clientName: z.string().trim().min(2, "Enter a client name").max(160),
    type: z.enum(ASSESSMENT_TYPES),
    status: z.enum(ASSESSMENT_STATUSES).default("Draft"),
    scope: optionalText(4000),
    startDate: optionalDate,
    endDate: optionalDate,
    leadConsultant: optionalText(160),
    executiveSummary: optionalText(8000),
    notes: optionalText(8000),
  })
  .refine(
    (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
    { message: "End date cannot be before the start date.", path: ["endDate"] }
  );

export type AssessmentInput = z.infer<typeof assessmentSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  organization: z.string().trim().min(2, "Enter an organization name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(1, "Enter your password").max(200),
});

export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  role: z.enum(ROLES),
  password: z.string().min(8, "Temporary password must be at least 8 characters").max(200),
});

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org";
}
