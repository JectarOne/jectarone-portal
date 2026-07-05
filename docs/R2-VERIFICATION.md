# Production storage (Cloudflare R2) — verification checklist

The evidence upload flow is validated locally against **MinIO** (S3-compatible),
which emulates production R2. This document verifies the **exact same flow**
against R2. Run it yourself with R2 credentials.

> ⚠️ **Use a dedicated staging/test R2 bucket.** The tests and smoke upload
> write and delete objects. Never point them at the live `jectarone-evidence`
> bucket. The automated agent did **not** run these against production — it has
> no R2 credentials and must not write to a production bucket.

R2 is S3-compatible, so the same code path (`@aws-sdk/client-s3` +
`s3-request-presigner`, `forcePathStyle`) works unchanged. Only the endpoint,
bucket, and keys differ.

## 1. Credentials & CORS (one-time)

In the Cloudflare dashboard → R2:
1. Create a bucket, e.g. `jectarone-evidence-staging`. Keep it **private**.
2. Create an R2 API token (Object Read & Write) → note the Access Key ID / Secret.
3. Note the S3 endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. Add **bucket CORS** so the browser presigned PUT works:
   ```json
   [{ "AllowedOrigins": ["https://portal.jectar.one"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3000 }]
   ```

## 2. Storage-layer verification (aws-sdk ↔ R2)

Runs the identical suite used for MinIO — presigned PUT/GET, signed-URL expiry,
delete, bad-credential rejection, nonexistent-bucket failure, concurrent uploads.

```bash
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com" \
S3_BUCKET="jectarone-evidence-staging" \
S3_REGION="auto" \
S3_ACCESS_KEY_ID="<R2_ACCESS_KEY>" \
S3_SECRET_ACCESS_KEY="<R2_SECRET>" \
npm run test:storage
```
Expected: `tests 7 … pass 7`. Objects are written under an `org/test-<ts>/`
prefix and deleted by the test teardown.

## 3. App-level smoke test (browser → R2)

```bash
# In .env, set the same S3_* values as above (staging bucket), then:
npm run dev
```
Log in, open a finding, upload a PNG:
- The object appears in the R2 bucket (Cloudflare dashboard → bucket).
- The finding shows an inline thumbnail (presigned GET against R2).
- "Download" streams the file (presigned GET, `attachment`).
- Delete the evidence → confirm the object is **gone** from the R2 bucket
  (the orphan-delete fix; verify in the dashboard).

## 4. Checklist to sign off

- [ ] `npm run test:storage` against R2 → 7/7 pass
- [ ] Browser upload lands an object in the R2 bucket
- [ ] Thumbnail renders (presigned GET)
- [ ] Download works (presigned GET, attachment)
- [ ] Evidence delete removes the R2 object (no orphan)
- [ ] Invalid MIME / >25 MB rejected before any presigned URL is issued
- [ ] Bucket is private; only presigned URLs grant access; CORS limited to the app origin

## Notes / production considerations

- **CSP**: production is https, so `connect-src 'self' https:` / `img-src … https:`
  already permit R2. The dev-only `unsafe-eval` + `http://localhost:9000`
  relaxations never apply in production (`NODE_ENV=production`).
- **Orphaned uploads from abandoned sessions**: a presigned PUT can succeed while
  the browser never calls `registerEvidenceAction` (tab closed mid-upload),
  leaving an object with no DB row. Mitigate with an **R2 lifecycle rule** that
  expires objects under keys never referenced by a `Evidence.storageKey`
  (or a periodic reconciliation job). The delete path is already clean (§3).
