import type { WorldlineSessionPayload } from "@/services/paymentService";

/**
 * `checkout.js` is only a loader: it attaches `pnCheckout` to whatever jQuery is on
 * `window`, then fetches its versioned implementation the first time checkout runs.
 * Calls made before that arrives are queued by the SDK, so launching immediately is safe.
 *
 * jQuery is served from our own origin because the copy Paynimo's docs point at
 * (paynimocheckout/client/lib/jquery.min.js) no longer exists.
 */
const JQUERY_SRC = "/vendor/jquery-3.7.1.min.js";
const PAYNIMO_CHECKOUT_SRC = "https://www.paynimo.com/paynimocheckout/server/lib/checkout.js";

type PnCheckoutFn = (payload: WorldlineSessionPayload) => void;

interface PaynimoJQuery {
  pnCheckout?: PnCheckoutFn;
}

declare global {
  interface Window {
    $?: PaynimoJQuery;
    jQuery?: PaynimoJQuery;
  }
}

const scriptLoads = new Map<string, Promise<void>>();
let sdkLoad: Promise<void> | null = null;
let overlayWatch: MutationObserver | null = null;

function loadScript(src: string): Promise<void> {
  const inFlight = scriptLoads.get(src);
  if (inFlight) return inFlight;

  const load = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      // Drop the tag and the memo so a retry re-requests instead of seeing a
      // dead <script> in the DOM and assuming the script is already loaded.
      el.remove();
      scriptLoads.delete(src);
      reject(new Error(`Failed to load payment SDK script: ${src}`));
    };
    document.head.appendChild(el);
  });

  scriptLoads.set(src, load);
  return load;
}

function paynimoJQuery(): PaynimoJQuery | undefined {
  const $ = window.$ ?? window.jQuery;
  return $?.pnCheckout ? $ : undefined;
}

/** Load jQuery + the Paynimo checkout loader once per session. */
export async function loadPaynimoScripts(): Promise<void> {
  if (paynimoJQuery()) return;

  if (!sdkLoad) {
    sdkLoad = (async () => {
      if (!window.jQuery && !window.$) {
        await loadScript(JQUERY_SRC);
      }
      await loadScript(PAYNIMO_CHECKOUT_SRC);
      if (!paynimoJQuery()) {
        throw new Error("Paynimo checkout SDK loaded but pnCheckout is unavailable.");
      }
    })().catch((err: unknown) => {
      sdkLoad = null;
      throw err;
    });
  }

  return sdkLoad;
}

function isPaynimoOverlayPresent(): boolean {
  const nodes = document.querySelectorAll(
    "#paynimocheckout, #paynimoCheckout, .paynimo-checkout, [id*='paynimo'], [id*='Paynimo'], iframe[src*='paynimo'], iframe[src*='worldline']",
  );
  return nodes.length > 0;
}

/** Mark the document so CSS can lift stacking / overflow while the gateway is open. */
function markPaynimoOpen(): void {
  document.documentElement.classList.add("paynimo-open");
  document.body.classList.add("paynimo-open");

  overlayWatch?.disconnect();
  overlayWatch = new MutationObserver(() => {
    if (!isPaynimoOverlayPresent() && !document.querySelector(".modal-backdrop, .modal.show")) {
      // Paynimo often leaves a brief empty frame; wait one tick before clearing.
      requestAnimationFrame(() => {
        if (!isPaynimoOverlayPresent()) {
          document.documentElement.classList.remove("paynimo-open");
          document.body.classList.remove("paynimo-open");
          overlayWatch?.disconnect();
          overlayWatch = null;
        }
      });
    }
  });
  overlayWatch.observe(document.body, { childList: true, subtree: true });
}

/**
 * Normalize the signed session for the web SDK.
 * - `paymentMode: all` so instrument tabs always render
 * - express-pay off (saved-instrument-only UI can look empty with no cards on file)
 */
function payloadForWebCheckout(sessionPayload: WorldlineSessionPayload): WorldlineSessionPayload {
  return {
    ...sessionPayload,
    features: {
      ...sessionPayload.features,
      enableAbortResponse: true,
      enableMerTxnDetails: true,
      showLoader: true,
      enableExpressPay: false,
      enableInstrumentDeRegistration: false,
    },
    consumerData: {
      ...sessionPayload.consumerData,
      paymentMode: "all",
    },
  };
}

/**
 * Launch Worldline/Paynimo hosted checkout using the server-signed session payload.
 * On success the gateway redirects to the backend returnUrl — this promise intentionally
 * does not resolve in that case (the page navigates away).
 */
export async function launchPaynimoCheckout(sessionPayload: WorldlineSessionPayload): Promise<void> {
  await loadPaynimoScripts();
  const $ = paynimoJQuery();
  if (!$?.pnCheckout) {
    throw new Error("Paynimo checkout SDK is not available.");
  }
  markPaynimoOpen();
  $.pnCheckout(payloadForWebCheckout(sessionPayload));
}
