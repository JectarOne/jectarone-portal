import { NextResponse } from "next/server";
import { sweepAllBillingNotifications } from "@/lib/billing";
import { logger } from "@/lib/logger";

/**
 * Daily billing sweep: expire lapsed trials, send "trial ending soon" emails.
 * Triggered by .github/workflows/billing-cron.yml. Protected by a shared
 * secret header (not session auth — this runs unattended, outside a browser).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  if (req.headers.get("x-cron-secret") !== secret) {
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
