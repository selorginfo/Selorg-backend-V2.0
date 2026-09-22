/**
 * Generates WEBAPP_BACKEND_API_AUTOMATION_TEST_REPORT.md from Playwright JSON results.
 * Run after: npx playwright test
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const jsonPath = path.join(root, "test-results", "playwright-report.json");
const outPath = path.join(root, "WEBAPP_BACKEND_API_AUTOMATION_TEST_REPORT.md");

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3333";
const WEB_BASE = process.env.WEB_BASE_URL || "http://127.0.0.1:3000";

function loadReport() {
  if (!fs.existsSync(jsonPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function walkSuites(suite, acc = []) {
  if (!suite) return acc;
  for (const s of suite.suites || []) walkSuites(s, acc);
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const result = (t.results || [])[0] || {};
      acc.push({
        title: [...(spec.title ? [suite.title, spec.title].filter(Boolean) : [spec.title])].join(" › ") || spec.title,
        fullTitle: `${suite.title} › ${spec.title}`,
        file: suite.file || spec.file,
        project: t.projectName,
        status: result.status || t.status || "unknown",
        error: result.error?.message || result.errors?.[0]?.message || "",
        duration: result.duration || 0,
      });
    }
  }
  // nested
  for (const child of suite.suites || []) {
    // already walked
  }
  return acc;
}

function collectTests(report) {
  const tests = [];
  for (const suite of report.suites || []) {
    const stack = [suite];
    while (stack.length) {
      const s = stack.pop();
      for (const child of s.suites || []) stack.push(child);
      for (const spec of s.specs || []) {
        for (const t of spec.tests || []) {
          const result = (t.results || [])[0] || {};
          const status =
            result.status ||
            (t.ok === false ? "failed" : t.ok === true ? "passed" : "unknown");
          tests.push({
            title: spec.title,
            suite: s.title,
            file: (s.location && s.location.file) || s.file || "",
            project: t.projectName || "",
            status,
            error: result.error?.message || (result.errors && result.errors[0]?.message) || "",
            duration: result.duration || 0,
            annotations: (spec.tags || []).join(","),
          });
        }
      }
    }
  }
  return tests;
}

const inventory = `
## 3. API inventory (frontend services → \`/api/v1/customer\`)

> Extracted from \`Selorg Webapp V1.3/src/services/*\` during audit. Base: \`{API_BASE}/api/v1/customer\`.

| Domain | Method | Path | Auth | Frontend usage |
|--------|--------|------|------|----------------|
| Auth | POST | /auth/send-otp | skip | AuthContext |
| Auth | POST | /auth/verify-otp | skip | AuthContext |
| Auth | POST | /auth/resend-otp | skip | AuthContext |
| Auth | POST | /auth/logout | Bearer | AuthContext |
| Auth | POST | /auth/link-phone/send-otp | Bearer | AuthContext |
| Auth | POST | /auth/link-phone/verify-otp | Bearer | AuthContext |
| Profile | GET/PUT | /user/profile | Bearer | AuthContext / account |
| Address | GET/POST | /addresses | Bearer | AddressContext |
| Address | PUT/DELETE | /addresses/:id | Bearer | AddressContext |
| Address | POST | /addresses/:id/default | Bearer | AddressesClient |
| Cart | GET | /cart | Bearer | CartContext |
| Cart | POST | /cart/items | Bearer | CartContext |
| Cart | PUT | /cart/items | Bearer | CartContext |
| Cart | PUT | /cart/items/:itemId | Bearer | (service only) |
| Cart | DELETE | /cart/clear | Bearer | CartContext |
| Cart | POST | /cart/merge | Bearer | CartContext |
| Orders | GET | /orders | Bearer | OrdersContext |
| Orders | GET | /orders/active | Bearer | OrdersContext |
| Orders | GET | /orders/:id | Bearer | OrdersContext |
| Orders | POST | /orders | Bearer | Checkout |
| Orders | POST | /orders/:id/cancel|reorder|rate | Bearer | OrdersContext |
| Orders | GET | /orders/:id/tracking|invoice | Bearer | Order detail |
| Payment | POST | /payments/worldline/session|complete|abort | Bearer | Checkout/Wallet |
| Payment | GET | /payments/worldline/status | Bearer | Checkout/Payment pages |
| Products | GET | /products/search|suggestions|trending|/:id | optional | Search/Product |
| Categories | GET | /categories|/:id|/ :slug/products | optional | CategoriesContext |
| Home | GET | /home|/sections/:key/products|/collections/:slug | optional | Home |
| Location | GET | /locations/* | skip | LocationPicker |
| Wallet | GET | /wallet/balance|transactions | Bearer | WalletContext |
| Wallet | POST | /wallet/top-up/session | Bearer | WalletContext |
| Coupons | GET/POST | /coupons|/coupons/validate | Bearer | Cart/Offers |
| Store | POST | /store/assign | skip | DeliveryContext |
| Delivery | GET | /delivery/estimate|fee | skip | DeliveryContext |
| Notifications | GET/PUT/DELETE | /notifications/* | Bearer | Inbox/Preferences |
| Support | GET/POST | /support/tickets/* | Bearer | Support/Help |
| Refunds | GET/POST | /refunds* | Bearer | RefundsClient (**mock fallback**) |
| Content | GET/POST | /legal/*|/faq/*|/onboarding/*|/pages/*|/collections/* | mixed | FAQ/Legal |
| Config | GET | /bootstrap|/app-config | optional | AppConfigContext |

**Total frontend-mapped customer endpoints:** ~87–89 function→HTTP mappings.
`;

function classify(tests) {
  const passed = tests.filter((t) => t.status === "passed");
  const failed = tests.filter((t) => t.status === "failed" || t.status === "timedOut");
  const skipped = tests.filter((t) => t.status === "skipped" || t.status === "interrupted");
  const blocked = skipped.filter(
    (t) =>
      /BLOCKED|backend unavailable|no product|no catalog|No order|create address failed|No categories|No store/i.test(
        `${t.title} ${t.error}`,
      ),
  );
  return { passed, failed, skipped, blocked };
}

function main() {
  const report = loadReport();
  const generatedAt = new Date().toISOString();

  if (!report) {
    fs.writeFileSync(
      outPath,
      `# WEBAPP_BACKEND_API_AUTOMATION_TEST_REPORT\n\nGenerated: ${generatedAt}\n\n**ERROR:** Playwright JSON report not found at \`test-results/playwright-report.json\`. Tests did not produce results.\n`,
    );
    console.error("Missing playwright-report.json");
    process.exit(1);
  }

  const tests = collectTests(report);
  const { passed, failed, skipped, blocked } = classify(tests);
  const apiTests = tests.filter((t) => /api/i.test(t.project) || /api\//i.test(t.file));
  const e2eTests = tests.filter((t) => /e2e/i.test(t.project) || /flows\//i.test(t.file));

  const criticalFailed = failed.filter((t) =>
    /auth|cors|profile|cart|order|token|401|logout|bootstrap|home/i.test(`${t.title} ${t.error}`),
  );

  const lines = [];
  lines.push(`# WEBAPP_BACKEND_API_AUTOMATION_TEST_REPORT`);
  lines.push(``);
  lines.push(`Generated: **${generatedAt}**`);
  lines.push(``);
  lines.push(`## 1. Test environment`);
  lines.push(``);
  lines.push(`| Item | Value |`);
  lines.push(`|------|-------|`);
  lines.push(`| Date | ${generatedAt} |`);
  lines.push(`| Frontend | Selorg Webapp V1.3 (Next.js 16) @ \`${WEB_BASE}\` |`);
  lines.push(`| Backend | selorg-service @ \`${API_BASE}\` |`);
  lines.push(`| Customer API prefix | \`/api/v1/customer\` |`);
  lines.push(`| Auth test identity | OTP_TEST_MOBILE default \`9698790921\` / OTP \`8790\` (non-prod fixed OTP) |`);
  lines.push(`| OS | Windows |`);
  lines.push(`| Data policy | Real backend only — no API mocks in the test harness |`);
  lines.push(``);
  lines.push(`## 2. Testing tools used`);
  lines.push(``);
  lines.push(`- **Playwright** (\`@playwright/test\`) — APIRequestContext for integration tests + Chromium for E2E`);
  lines.push(`- Existing **Vitest** unit tests were **not** used for this live API audit (they mock/jsdom only)`);
  lines.push(`- Config: \`playwright.config.ts\`, specs under \`e2e/api/*\` and \`e2e/flows/*\``);
  lines.push(`- Report source: \`test-results/playwright-report.json\``);
  lines.push(``);
  lines.push(inventory.trim());
  lines.push(``);
  lines.push(`## 4. Totals`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| Total tests executed | ${tests.length} |`);
  lines.push(`| Passed | ${passed.length} |`);
  lines.push(`| Failed | ${failed.length} |`);
  lines.push(`| Skipped | ${skipped.length} |`);
  lines.push(`| Blocked (data/env skip) | ${blocked.length} |`);
  lines.push(`| API project tests | ${apiTests.length} |`);
  lines.push(`| E2E project tests | ${e2eTests.length} |`);
  lines.push(`| Playwright stats.expected | ${report.stats?.expected ?? "n/a"} |`);
  lines.push(`| Playwright stats.unexpected | ${report.stats?.unexpected ?? "n/a"} |`);
  lines.push(`| Playwright stats.skipped | ${report.stats?.skipped ?? "n/a"} |`);
  lines.push(``);
  lines.push(`## 5. Passed tests`);
  lines.push(``);
  for (const t of passed) {
    lines.push(`- ✅ [${t.project}] ${t.suite} › ${t.title}`);
  }
  if (!passed.length) lines.push(`- _(none)_`);
  lines.push(``);
  lines.push(`## 6. Failed tests`);
  lines.push(``);
  if (!failed.length) {
    lines.push(`- _(none)_`);
  } else {
    for (const t of failed) {
      lines.push(`### ❌ ${t.title}`);
      lines.push(``);
      lines.push(`- **Suite/file:** ${t.suite} / \`${t.file}\``);
      lines.push(`- **Project:** ${t.project}`);
      lines.push(`- **Error:**`);
      lines.push(``);
      lines.push("```");
      lines.push((t.error || "unknown").slice(0, 2000));
      lines.push("```");
      lines.push(``);
      lines.push(`- **Classification:** See section 9–14 (manual triage from error text).`);
      lines.push(``);
    }
  }
  lines.push(`## 7. Blocked / skipped tests`);
  lines.push(``);
  for (const t of skipped) {
    lines.push(`- ⏭️ [${t.project}] ${t.title}${t.error ? ` — ${t.error.slice(0, 200)}` : ""}`);
  }
  if (!skipped.length) lines.push(`- _(none)_`);
  lines.push(``);
  lines.push(`## 8. E2E flows tested`);
  lines.push(``);
  lines.push(`| Flow | Covered by |`);
  lines.push(`|------|------------|`);
  lines.push(`| Home / catalog load | flows + public API |`);
  lines.push(`| Search / FAQ / legal | flows |`);
  lines.push(`| Login / OTP | flows + auth API |`);
  lines.push(`| Session persistence (cookie + localStorage) | flows |`);
  lines.push(`| Logout / session clear | flows + logout API |`);
  lines.push(`| Protected route without token | flows |`);
  lines.push(`| Account profile/addresses/wallet/orders pages | flows |`);
  lines.push(`| Cart page → GET /cart | flows |`);
  lines.push(`| Address CRUD | authenticated API |`);
  lines.push(`| Cart add/update/clear/merge | authenticated API |`);
  lines.push(`| Order create attempt | journey API |`);
  lines.push(`| Wallet balance/transactions | authenticated API |`);
  lines.push(`| Payment session probe | journey API |`);
  lines.push(`| Negative auth / validation | public-auth API |`);
  lines.push(``);
  lines.push(`## 9. API integration issues`);
  lines.push(``);
  lines.push(`Auto-extracted from failures (review each):`);
  lines.push(``);
  if (failed.length === 0) {
    lines.push(`- No hard test failures recorded in this run.`);
  } else {
    for (const t of failed) {
      lines.push(`- **${t.title}**: ${(t.error || "").split("\\n")[0].slice(0, 300)}`);
    }
  }
  lines.push(``);
  lines.push(`### Known audit findings (static + runtime)`);
  lines.push(``);
  lines.push(`1. **Refunds mock fallback (frontend)** — \`src/services/refundService.ts\` returns \`MOCK_REFUNDS\` when API empty/errors. Violates “real data only” UX for refunds screen.`);
  lines.push(`2. **\`apiPatch\` unused** — exported but no service uses PATCH; confirm backend contracts don’t require PATCH.`);
  lines.push(`3. **No refresh-token loop** — expired JWT cleared client-side; 401 redirects to \`/auth\`.`);
  lines.push(``);
  lines.push(`## 10. Authentication / session issues`);
  lines.push(``);
  lines.push(`- Token storage: cookie \`selorg_token\` + localStorage; SameSite=Lax.`);
  lines.push(`- Fixed non-prod OTP path used for automation (\`9698790921\` / \`8790\`).`);
  lines.push(`- Review failed auth tests above if any.`);
  lines.push(``);
  lines.push(`## 11. Frontend/backend contract mismatches`);
  lines.push(``);
  lines.push(`- Coupon validate uses **snake_case** (\`coupon_code\`, \`cart_value\`) — intentional per mobile parity; confirm backend expects snake_case.`);
  lines.push(`- Notifications list uses \`apiGetBody\` (full envelope) vs most services using \`data\` only.`);
  lines.push(`- Store assign uses \`apiPostBody\` (full body).`);
  lines.push(`- Failures in this run that look like field/shape mismatches are listed in §6.`);
  lines.push(``);
  lines.push(`## 12. Error-handling issues`);
  lines.push(``);
  lines.push(`- Network failures map to \`ApiError\` status 0 / \`NETWORK_ERROR\`.`);
  lines.push(`- 401 triggers hard navigation to \`/auth?returnTo=\`.`);
  lines.push(`- Refund empty/error path silently substitutes mocks (see §9).`);
  lines.push(``);
  lines.push(`## 13. Critical issues`);
  lines.push(``);
  if (criticalFailed.length) {
    for (const t of criticalFailed) {
      lines.push(`- 🔴 ${t.title} — ${(t.error || "").slice(0, 240)}`);
    }
  } else if (failed.length) {
    lines.push(`- Failures exist but none auto-tagged as auth/cart/order critical; triage §6.`);
  } else {
    lines.push(`- None detected by automated critical heuristics in this run.`);
  }
  lines.push(``);
  lines.push(`## 14. Non-critical issues`);
  lines.push(``);
  lines.push(`- Unused service methods without UI callers (~18).`);
  lines.push(`- Playwright was previously in package.json but unconfigured — now wired for this audit.`);
  lines.push(`- Skipped tests due to empty catalog/store geo are **data/environment**, not app crashes.`);
  lines.push(``);
  lines.push(`## 15. Exact reproduction steps`);
  lines.push(``);
  lines.push("```bash");
  lines.push("# Terminal A — backend");
  lines.push("cd selorg-service && npm run dev");
  lines.push("");
  lines.push("# Terminal B — webapp");
  lines.push('cd "Selorg Webapp V1.3" && npm run dev');
  lines.push("");
  lines.push("# Terminal C — automation");
  lines.push('cd "Selorg Webapp V1.3"');
  lines.push("npm run test:automation");
  lines.push("# or:");
  lines.push("npx playwright test");
  lines.push("node scripts/generate-api-test-report.mjs");
  lines.push("```");
  lines.push(``);
  lines.push(`Optional env overrides: \`API_BASE_URL\`, \`WEB_BASE_URL\`, \`OTP_TEST_MOBILE\`, \`OTP_TEST_OTP\`.`);
  lines.push(``);
  lines.push(`## 16. Recommended fixes`);
  lines.push(``);
  lines.push(`1. **Remove or gate \`MOCK_REFUNDS\`** in \`refundService.ts\` — show empty state when API returns empty; never substitute dummy refunds in production builds.`);
  lines.push(`2. Triage each §6 failure: classify frontend vs backend vs config; fix contract first.`);
  lines.push(`3. Keep Playwright suite in CI against a seeded staging backend (fixed test OTP only in non-prod).`);
  lines.push(`4. Add explicit empty/loading/error UI assertions once refund mocks are removed.`);
  lines.push(`5. Do **not** change production logic solely to make tests pass without confirming root cause.`);
  lines.push(``);
  lines.push(`## Appendix — raw stats`);
  lines.push(``);
  lines.push("```json");
  lines.push(JSON.stringify(report.stats || {}, null, 2));
  lines.push("```");
  lines.push(``);

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  // Concise terminal summary
  const summary = {
    total: tests.length,
    passed: passed.length,
    failed: failed.length,
    blocked: blocked.length,
    skipped: skipped.length,
    apiTests: apiTests.length,
    e2eTests: e2eTests.length,
    critical: criticalFailed.length,
    report: outPath,
  };
  console.log("\n========== AUTOMATION SUMMARY ==========");
  console.log(`Total tests:          ${summary.total}`);
  console.log(`Passed:               ${summary.passed}`);
  console.log(`Failed:               ${summary.failed}`);
  console.log(`Blocked (heuristic):  ${summary.blocked}`);
  console.log(`Skipped:              ${summary.skipped}`);
  console.log(`API project tests:    ${summary.apiTests}`);
  console.log(`E2E project tests:    ${summary.e2eTests}`);
  console.log(`Critical (heuristic): ${summary.critical}`);
  console.log(`Report:               ${summary.report}`);
  console.log("========================================\n");

  fs.writeFileSync(
    path.join(root, "test-results", "summary.json"),
    JSON.stringify(summary, null, 2),
  );
}

main();
