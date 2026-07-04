/** @type {import('next').NextConfig} */

// Security response headers applied to every route.
// CSP is intentionally compatible with Next's inline hydration bootstrap and
// inline styles, and with direct-to-S3 presigned uploads/downloads:
//  - script-src 'unsafe-inline'  → Next App Router injects inline bootstrap
//  - style-src  'unsafe-inline'  → React/Next inline styles
//  - img-src / connect-src https: → S3 presigned GET (thumbnails) + PUT (upload)
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "font-src 'self' data:",
  "upgrade-insecure-requests",
].join("; ");

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
