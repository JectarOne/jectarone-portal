import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Edge middleware: cheap gate on /dashboard. Verifies the JWT signature only
// (no DB at the edge). Full authorization happens in server components/actions.
const COOKIE = "jo_session";

async function valid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const s = process.env.AUTH_SECRET;
  if (!s) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(s), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (await valid(token)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
