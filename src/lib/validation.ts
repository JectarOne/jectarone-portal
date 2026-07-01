import { z } from "zod";
import { ROLES } from "./rbac";

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
