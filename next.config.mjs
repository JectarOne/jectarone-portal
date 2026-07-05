/** @type {import('next').NextConfig} */

// Security response headers applied to every route.
// CSP is intentionally compatible with Next's inline hydration bootstrap and
// inline styles, and with direct-to-S3 presigned uploads/downloads:
//  - script-src 'unsafe-inline'  → Next App Router injects inline bootstrap
//  - style-src  'unsafe-inline'  → React/Next inline styles
//  - img-src / connect-src https: → S3 presigned GET (thumbnails) + PUT (upload)
//
// PRODUCTION stays strict. In DEVELOPMENT two relaxations are required (and safe,
// since they never ship to prod):
//  - 'unsafe-eval' — `next dev` uses eval() for HMR/bundling; without it the
//    dev CSP breaks all client-side JS (e.g. the evidence uploader).
//  - the local S3 endpoint + ws: — MinIO runs on http://localhost:9000 and HMR
//    uses a websocket; connect-src 'self' https: would block both. Production R2
//    is https, already covered by `https:`.
export function buildCsp({ dev = false, s3Endpoint = "" } = {}) {
  const scriptSrc = "script-src 'self' 'unsafe-inline'" + (dev ? " 'unsafe-eval'" : "");
  // Extra origins for a local/self-hosted http S3 endpoint (MinIO). Production
  // R2 is https, already covered by `https:`.
  const httpS3 = dev
    ? " http://localhost:9000 http://127.0.0.1:9000"
    : s3Endpoint && s3Endpoint.startsWith("http://")
      ? (() => { try { return " " + new URL(s3Endpoint).origin; } catch { return ""; } })()
      : "";
  const connect = "connect-src 'self' https:" + (dev ? " ws:" : "") + httpS3;
  const img = "img-src 'self' data: blob: https:" + httpS3;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    img,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    scriptSrc,
    connect,
    "font-src 'self' data: https://fonts.gstatic.com",
    "upgrade-insecure-requests",
  ].join("; ");
}

const csp = buildCsp({
  dev: process.env.NODE_ENV !== "production",
  s3Endpoint: process.env.S3_ENDPOINT || "",
});

export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // L1: stop leaking "X-Powered-By: Next.js"
  // Dev-only: allow the loopback host used by the local E2E harness.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
