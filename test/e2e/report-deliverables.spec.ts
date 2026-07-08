import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

const REPORT = "/dashboard/assessments/nw-web/report";

test.describe("report deliverables", () => {
  test("PDF, HTML, and DOCX all download with correct content types", async ({ page }) => {
    await login(page, USERS.consultant);

    const pdf = await page.request.get(REPORT);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    const html = await page.request.get(`${REPORT}?format=html`);
    expect(html.status()).toBe(200);
    expect(html.headers()["content-type"]).toContain("text/html");
    const body = await html.text();
    expect(body).toContain("Assessment Report");
    expect(body).toContain("Detailed Findings");
    expect(body).toContain("OWASP Top 10 Mapping"); // enabled by default

    const docx = await page.request.get(`${REPORT}?format=docx`);
    expect(docx.status()).toBe(200);
    expect(docx.headers()["content-type"]).toContain("openxmlformats-officedocument.wordprocessingml");
  });

  test("HTML honors the report config (disabled section + custom content)", async ({ page }) => {
    await login(page, USERS.consultant);

    // Configure: exclude OWASP, add custom recommendations + appendix.
    await page.goto("/dashboard/assessments/nw-web/report/builder");
    await page.getByRole("checkbox", { name: /include OWASP Top 10 Mapping/i }).uncheck();
    const rec = "Adopt continuous testing " + Date.now();
    await page.getByLabel(/custom recommendations/i).fill(rec);
    await page.getByLabel(/^appendix/i).fill("Tooling: Burp, nmap, testssl.");
    await page.getByRole("button", { name: /save configuration/i }).click();
    await expect(page.getByText(/report configuration saved/i)).toBeVisible();

    const html = await (await page.request.get(`${REPORT}?format=html`)).text();
    expect(html).not.toContain("OWASP Top 10 Mapping"); // excluded
    expect(html).toContain(rec);                          // custom recommendations
    expect(html).toContain("testssl");                    // appendix
  });

  test("client cannot download reports", async ({ page }) => {
    await login(page, USERS.client);
    const resp = await page.request.get(REPORT);
    expect(resp.status()).toBe(403);
  });
});
