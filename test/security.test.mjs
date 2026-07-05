import { test } from "node:test";
import assert from "node:assert/strict";
import { securityHeaders, buildCsp } from "../next.config.mjs";
import nextConfig from "../next.config.mjs";

// ---------- M1/L1: security response headers ----------
test("security headers include CSP, framing, nosniff, referrer, HSTS", () => {
  const map = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
  assert.ok(map["Content-Security-Policy"], "CSP present");
  assert.match(map["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(map["Content-Security-Policy"], /object-src 'none'/);
  assert.equal(map["X-Frame-Options"], "DENY");
  assert.equal(map["X-Content-Type-Options"], "nosniff");
  assert.match(map["Referrer-Policy"], /strict-origin/);
  assert.match(map["Strict-Transport-Security"], /max-age=\d+/);
  assert.ok(map["Permissions-Policy"], "Permissions-Policy present");
});

test("CSP allows S3 presigned uploads/thumbnails and Next inline bootstrap", () => {
  const map = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
  const csp = map["Content-Security-Policy"];
  assert.match(csp, /img-src[^;]*https:/, "thumbnails from presigned S3 GET");
  assert.match(csp, /connect-src[^;]*https:/, "browser PUT to S3");
  assert.match(csp, /script-src[^;]*'unsafe-inline'/, "Next hydration bootstrap");
  assert.match(csp, /style-src[^;]*fonts\.googleapis\.com/, "Google Fonts stylesheet");
  assert.match(csp, /font-src[^;]*fonts\.gstatic\.com/, "Google Fonts files");
});

test("production CSP stays strict; dev relaxes only for tooling/local S3", () => {
  const prod = buildCsp({ dev: false, s3Endpoint: "" });
  assert.doesNotMatch(prod, /'unsafe-eval'/, "prod must NOT allow unsafe-eval");
  assert.doesNotMatch(prod, /localhost:9000/, "prod must not whitelist local S3");
  assert.match(prod, /connect-src[^;]*https:/, "prod S3 (R2, https) still allowed");

  const dev = buildCsp({ dev: true });
  assert.match(dev, /script-src[^;]*'unsafe-eval'/, "dev needs unsafe-eval for next dev HMR");
  assert.match(dev, /connect-src[^;]*http:\/\/localhost:9000/, "dev allows MinIO fetch");
  assert.match(dev, /img-src[^;]*http:\/\/localhost:9000/, "dev allows MinIO thumbnails");

  // A self-hosted http S3 endpoint in a non-dev deploy is whitelisted explicitly.
  const selfHosted = buildCsp({ dev: false, s3Endpoint: "http://minio.internal:9000" });
  assert.match(selfHosted, /connect-src[^;]*http:\/\/minio\.internal:9000/);
});

test("poweredByHeader disabled and headers wired to all routes", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  const rules = await nextConfig.headers();
  assert.equal(rules[0].source, "/:path*");
  assert.ok(rules[0].headers.some((h) => h.key === "Content-Security-Policy"));
});

// ---------- Login brute-force throttle (mirror of src/lib/rate-limit.ts) ----------
const LOGIN_MAX_PER_EMAIL = 5;
const LOGIN_MAX_PER_IP = 20;
const isLockedOut = (count, max) => count >= max;

// mirror of getClientIp's parsing of x-forwarded-for
function clientIp(xff, xreal) {
  if (xff) return xff.split(",")[0].trim() || "0.0.0.0";
  return xreal || "0.0.0.0";
}

test("isLockedOut trips at the cap, not before", () => {
  assert.equal(isLockedOut(4, LOGIN_MAX_PER_EMAIL), false);
  assert.equal(isLockedOut(5, LOGIN_MAX_PER_EMAIL), true);
  assert.equal(isLockedOut(19, LOGIN_MAX_PER_IP), false);
  assert.equal(isLockedOut(20, LOGIN_MAX_PER_IP), true);
});

test("client IP takes the first x-forwarded-for hop, falls back safely", () => {
  assert.equal(clientIp("203.0.113.9, 10.0.0.1", null), "203.0.113.9");
  assert.equal(clientIp("  198.51.100.2  ", null), "198.51.100.2");
  assert.equal(clientIp(null, "192.0.2.5"), "192.0.2.5");
  assert.equal(clientIp(null, null), "0.0.0.0");
});
