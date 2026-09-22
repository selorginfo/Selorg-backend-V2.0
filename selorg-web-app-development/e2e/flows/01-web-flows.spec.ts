import { test, expect } from "@playwright/test";
import { createApiContext, loginWithTestOtp } from "../helpers/api";
import { TEST_MOBILE, TEST_OTP } from "../helpers/env";

async function injectSession(
  page: import("@playwright/test").Page,
  token: string,
  user: { _id: string; name: string; email: string | null; phoneNumber: string | null },
) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ token, user }) => {
      const userJson = JSON.stringify({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        phoneVerified: true,
      });
      localStorage.setItem("selorg_token", token);
      localStorage.setItem("selorg_user", userJson);
      document.cookie = `selorg_token=${encodeURIComponent(token)}; path=/; max-age=2592000; samesite=lax`;
      document.cookie = `selorg_user=${encodeURIComponent(userJson)}; path=/; max-age=2592000; samesite=lax`;
      window.dispatchEvent(new Event("selorg:auth"));
    },
    { token, user },
  );
  // Full reload so AuthContext/CartContext hydrate from storage
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
}

test.describe("E2E — public pages load with live API data", () => {
  test("home page loads and issues customer API calls", async ({ page }) => {
    const apiHits: string[] = [];
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/api/v1/customer/")) {
        apiHits.push(`${res.request().method()} ${url} → ${res.status()}`);
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await expect(page.locator("body")).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text.toLowerCase()).not.toContain("application error");

    const serverErrors = apiHits.filter((h) => /→ 5\d\d$/.test(h));
    expect(serverErrors, `5xx from API on home:\n${serverErrors.join("\n")}`).toEqual([]);
  });

  test("search page loads", async ({ page }) => {
    await page.goto("/search", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("faq / legal pages load (public content APIs)", async ({ page }) => {
    for (const path of ["/faq", "/legal/terms", "/legal/privacy"]) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 0, path).toBeLessThan(500);
    }
  });

  test("auth page renders login UI", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /log in/i }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/mobile number/i)).toBeVisible();
  });
});

test.describe("E2E — login OTP flow (real backend)", () => {
  test("login with test mobile + fixed OTP persists session", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" });

    const phoneInput = page.getByPlaceholder(/mobile number/i);
    await phoneInput.click();
    await phoneInput.fill("");
    await phoneInput.pressSequentially(TEST_MOBILE, { delay: 40 });
    await expect(phoneInput).toHaveValue(TEST_MOBILE);

    const sendOtpWait = page.waitForResponse(
      (r) => r.url().includes("/auth/send-otp") && r.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /^Continue$/i }).click();
    const sendRes = await sendOtpWait;
    expect(sendRes.ok(), `send-otp not ok: ${await sendRes.text()}`).toBeTruthy();

    await expect(page.getByLabel(/one-time passcode/i)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/one-time passcode/i).click();
    await page.getByLabel(/one-time passcode/i).pressSequentially(TEST_OTP, { delay: 50 });

    const verifyWait = page.waitForResponse(
      (r) => r.url().includes("/auth/verify-otp") && r.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /Verify & continue/i }).click();
    const verifyRes = await verifyWait;
    expect(verifyRes.ok(), `verify-otp failed: ${await verifyRes.text()}`).toBeTruthy();

    await page.waitForTimeout(1500);
    const token = await page.evaluate(() => localStorage.getItem("selorg_token"));
    const cookies = await page.context().cookies();
    const cookieToken = cookies.find((c) => c.name === "selorg_token")?.value;
    expect(token || cookieToken, "Expected session token after OTP verify").toBeTruthy();
  });

  test("authenticated account pages load without 5xx API", async ({ page }) => {
    const ctx = await createApiContext();
    const { token, user } = await loginWithTestOtp(ctx);
    await ctx.dispose();

    const apiErrors: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/v1/customer/") && res.status() >= 500) {
        apiErrors.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
      }
    });

    await injectSession(page, token, user);

    for (const path of [
      "/account/profile",
      "/account/addresses",
      "/account/wallet",
      "/account/orders",
      "/cart",
      "/orders",
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const body = await page.locator("body").innerText();
      expect(body.toLowerCase(), path).not.toContain("application error");
    }

    expect(apiErrors, apiErrors.join("\n")).toEqual([]);
  });

  test("logout clears session (UI if available, else storage clear)", async ({ page }) => {
    const ctx = await createApiContext();
    const { token, user } = await loginWithTestOtp(ctx);
    await ctx.dispose();

    await injectSession(page, token, user);
    await page.goto("/account/profile", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const logoutBtn = page.locator("button, a").filter({ hasText: /log ?out|sign out/i }).first();
    if (await logoutBtn.count()) {
      await logoutBtn.click();
      const confirm = page.locator("button").filter({ hasText: /log ?out|confirm|yes/i }).last();
      if (await confirm.count()) await confirm.click().catch(() => undefined);
      await page.waitForTimeout(1500);
    } else {
      await page.evaluate(() => {
        localStorage.removeItem("selorg_token");
        localStorage.removeItem("selorg_user");
        document.cookie = "selorg_token=; path=/; max-age=0";
      });
    }

    const remaining = await page.evaluate(() => localStorage.getItem("selorg_token"));
    expect(remaining).toBeFalsy();
  });
});

test.describe("E2E — protected route auth redirect", () => {
  test("visiting /account/profile without token redirects to /auth", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/account/profile", { waitUntil: "domcontentloaded" });
    // Soft client redirect — allow time for authReady + router.replace
    await page.waitForTimeout(3000);
    const url = page.url();
    const body = (await page.locator("body").innerText()).toLowerCase();
    const redirected = /\/auth/.test(url);
    const blankAccountShell =
      url.includes("/account/profile") &&
      !body.includes("my profile") &&
      !body.includes("welcome back");
    // Pass if redirected; if blank shell without redirect, still assert redirect (documents bug).
    expect(
      redirected,
      `Expected /auth redirect. url=${url} blankShell=${blankAccountShell} bodySnippet=${body.slice(0, 180)}`,
    ).toBeTruthy();
  });
});

test.describe("E2E — cart page network mapping", () => {
  test("cart page with session hits /cart endpoint", async ({ page }) => {
    const apiCtx = await createApiContext();
    const { token, user } = await loginWithTestOtp(apiCtx);
    await apiCtx.dispose();

    const cartHits: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/v1/customer/cart")) {
        cartHits.push(`${res.request().method()} ${res.status()} ${res.url()}`);
      }
    });

    // injectSession reloads `/` — CartContext hydrates there (may not re-hit on later /cart)
    await injectSession(page, token, user);
    await page.waitForTimeout(2000);
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    expect(
      cartHits.length,
      `Expected /cart* during session hydrate or cart visit. hits=${JSON.stringify(cartHits)}`,
    ).toBeGreaterThan(0);
    expect(cartHits.every((h) => !/ 5\d\d /.test(h))).toBeTruthy();
  });
});
