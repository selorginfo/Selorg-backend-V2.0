import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Records scripts the loader appends, in order, so tests can settle them by hand.
 * Elements still land in the real DOM so tag cleanup is exercised too.
 */
function trackScripts() {
  const scripts: HTMLScriptElement[] = [];
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
    scripts.push(node as unknown as HTMLScriptElement);
    return append(node);
  });

  return {
    get count() {
      return scripts.length;
    },
    at(index: number): HTMLScriptElement {
      const el = scripts[index];
      if (!el) throw new Error(`no script appended at index ${index}`);
      return el;
    },
    fire(index: number, type: "load" | "error") {
      const el = this.at(index);
      const handler = type === "load" ? el.onload : el.onerror;
      handler?.call(el, new Event(type));
    },
  };
}

function importPaynimo() {
  return import("./paynimo");
}

function installJQuery() {
  window.$ = window.jQuery = { pnCheckout: vi.fn() };
}

describe("loadPaynimoScripts", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.querySelectorAll("script").forEach((el) => el.remove());
    delete window.$;
    delete window.jQuery;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads jQuery before the Paynimo checkout loader", async () => {
    const tracked = trackScripts();
    const { loadPaynimoScripts } = await importPaynimo();

    const loading = loadPaynimoScripts();

    expect(tracked.count).toBe(1);
    expect(tracked.at(0).src).toContain("/vendor/jquery-3.7.1.min.js");

    installJQuery();
    tracked.fire(0, "load");
    await Promise.resolve();

    expect(tracked.count).toBe(2);
    expect(tracked.at(1).src).toBe("https://www.paynimo.com/paynimocheckout/server/lib/checkout.js");

    tracked.fire(1, "load");
    await expect(loading).resolves.toBeUndefined();
  });

  it("skips our jQuery copy when the page already has one", async () => {
    installJQuery();
    const tracked = trackScripts();
    const { loadPaynimoScripts } = await importPaynimo();

    await loadPaynimoScripts();

    expect(tracked.count).toBe(0);
  });

  it("re-requests a script after a failure instead of treating it as loaded", async () => {
    const tracked = trackScripts();
    const { loadPaynimoScripts } = await importPaynimo();

    const firstAttempt = loadPaynimoScripts();
    tracked.fire(0, "error");
    await expect(firstAttempt).rejects.toThrow(/Failed to load payment SDK script/);

    // The dead tag must be gone, otherwise a retry mistakes it for a loaded script.
    expect(document.head.querySelectorAll("script")).toHaveLength(0);

    const retry = loadPaynimoScripts();
    expect(tracked.count).toBe(2);
    expect(tracked.at(1).src).toContain("/vendor/jquery-3.7.1.min.js");

    installJQuery();
    tracked.fire(1, "load");
    await Promise.resolve();
    tracked.fire(2, "load");

    await expect(retry).resolves.toBeUndefined();
  });

  it("reports when checkout.js loads without registering pnCheckout", async () => {
    const tracked = trackScripts();
    const { loadPaynimoScripts } = await importPaynimo();

    const loading = loadPaynimoScripts();
    window.$ = window.jQuery = {};
    tracked.fire(0, "load");
    await Promise.resolve();
    tracked.fire(1, "load");

    await expect(loading).rejects.toThrow(/pnCheckout is unavailable/);
  });
});
