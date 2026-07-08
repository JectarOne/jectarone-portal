import { z } from "zod";
import { ROLES } from "./rbac";
import { ASSESSMENT_TYPES, ASSESSMENT_STATUSES } from "./assessments";
import { ENGAGEMENT_STATUSES } from "./engagements";
import { SEVERITIES, FINDING_STATUSES, ALL_STATUSES, LIKELIHOODS, IMPACTS, ASSET_TYPES, TEMPLATE_CATEGORIES, REVIEW_STATES } from "./findings";

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
    engagementId: optionalText(60),
  })
  .refine(
    (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
    { message: "End date cannot be before the start date.", path: ["endDate"] }
  );

export type AssessmentInput = z.infer<typeof assessmentSchema>;

export const engagementSchema = z
  .object({
    name: z.string().trim().min(2, "Enter an engagement name").max(160),
    clientName: z.string().trim().min(2, "Enter a client name").max(160),
    // The form has no status field on create (status is managed via the
    // lifecycle action) — formData.get("status") is null, and z.default() only
    // fills for undefined. Treat null/empty as absent so it defaults to Scoping.
    status: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? undefined : v),
      z.enum(ENGAGEMENT_STATUSES).default("Scoping")
    ),
    scope: optionalText(4000),
    startDate: optionalDate,
    endDate: optionalDate,
    leadConsultant: optionalText(160),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });
export type EngagementInput = z.infer<typeof engagementSchema>;

const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().min(min).max(max).optional()
  );

export const findingSchema = z.object({
  title: z.string().trim().min(3, "Enter a finding title").max(200),
  description: optionalText(8000),
  technicalDetails: optionalText(12000),
  businessImpact: optionalText(6000),
  remediation: optionalText(8000),
  verificationSteps: optionalText(6000),
  severity: z.enum(SEVERITIES),
  likelihood: z.enum(LIKELIHOODS),
  impact: z.enum(IMPACTS),
  // The finding form never submits status (status is managed by the workflow
  // action). formData.get("status") is therefore null, and z.default() only
  // fills for `undefined`, not `null` — so treat null/empty as absent → "Open".
  // Without this, UI create/edit of a finding fails Zod validation.
  status: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.enum(ALL_STATUSES).default("Open")
  ),
  cvssScore: optionalNumber(0, 10),
  cvssVector: optionalText(160),
  cwe: optionalText(40),
  owaspCategory: optionalText(80),
  mitreTechnique: optionalText(40),
  affectedAsset: optionalText(300),
  affectedAssetType: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(ASSET_TYPES).optional()
  ),
  assetId: optionalText(60),
});
export type FindingInput = z.infer<typeof findingSchema>;

export const findingTemplateSchema = z.object({
  title: z.string().trim().min(3, "Enter a template title").max(200),
  category: z.enum(TEMPLATE_CATEGORIES),
  severity: z.enum(SEVERITIES).default("Medium"),
  likelihood: z.enum(LIKELIHOODS).default("Medium"),
  impact: z.enum(IMPACTS).default("Medium"),
  cvssScore: optionalNumber(0, 10),
  cvssVector: optionalText(160),
  cwe: optionalText(40),
  owaspCategory: optionalText(80),
  mitreTechnique: optionalText(40),
  description: optionalText(8000),
  businessImpact: optionalText(6000),
  remediation: optionalText(8000),
  references: optionalText(2000),
});
export type FindingTemplateInput = z.infer<typeof findingTemplateSchema>;

export const evidenceSchema = z.object({
  filename: z.string().trim().min(1, "Enter a filename").max(260),
  mimeType: z.string().trim().min(1, "Enter a type").max(120),
  sizeBytes: optionalNumber(0, 5_000_000_000),
  note: optionalText(1000),
  storageKey: optionalText(400),
});
export type EvidenceInput = z.infer<typeof evidenceSchema>;

export const evidenceUploadSchema = z.object({
  filename: z.string().trim().min(1).max(260),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().min(1),
});

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200),
  type: z.enum(ASSET_TYPES),
  identifier: optionalText(300),
  notes: optionalText(4000),
});
export type AssetInput = z.infer<typeof assetSchema>;

// Sprint 5 — workflow schemas.
const optionalDateField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.date().optional()
);

export const statusChangeSchema = z.object({
  status: z.enum(FINDING_STATUSES),
});

export const reviewStateSchema = z.object({
  reviewState: z.enum(REVIEW_STATES),
});

export const assignSchema = z.object({
  assigneeId: optionalText(60), // empty string = unassign
});

export const dueDateSchema = z.object({
  dueDate: optionalDateField,
});

export const acceptRiskSchema = z.object({
  reason: z.string().trim().min(5, "A business justification is required").max(4000),
  until: optionalDateField,
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(8000),
  visibility: z.preprocess(
    (v) => (v === "client" ? "client" : "internal"),
    z.enum(["internal", "client"]).default("internal")
  ),
});
export type CommentInput = z.infer<typeof commentSchema>;

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
