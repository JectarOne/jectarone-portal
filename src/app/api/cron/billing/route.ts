import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sweepAllBillingNotifications } from "@/lib/billing";
import { logger } from "@/lib/logger";

/** Constant-time comparison — a plain !== short-circuits on the first
 * differing byte, leaking secret prefixes through response timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Daily billing sweep: expire lapsed trials, send "trial ending soon" emails.
 * Triggered by .github/workflows/billing-cron.yml. Protected by a shared
 * secret header (not session auth — this runs unattended, outside a browser).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  if (!secretsMatch(req.headers.get("x-cron-secret") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await sweepAllBillingNotifications();
    logger.info("Billing cron sweep complete", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("Billing cron sweep failed", err);
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }
}
