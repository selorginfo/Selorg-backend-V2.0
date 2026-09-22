/**
 * Build an in-app WebView HTML page that launches Paynimo/Worldline hosted checkout
 * using the `sessionPayload` returned by selorg-service.
 */
export function buildPaynimoCheckoutHtml(sessionPayload: Record<string, unknown>): string {
  const payloadJson = JSON.stringify(sessionPayload).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Secure Payment</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 24px; background: #FFFFFF; color: #2a3326; }
    .wrap { max-width: 420px; margin: 40px auto; text-align: center; }
    .err { color: #b42318; margin-top: 12px; font-size: 14px; }
  </style>
  <script
    src="https://code.jquery.com/jquery-3.7.1.min.js"
    integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
    crossorigin="anonymous"></script>
  <script src="https://www.paynimo.com/paynimocheckout/server/lib/checkout.js"></script>
</head>
<body>
  <div class="wrap">
    <p>Opening secure payment…</p>
    <p id="err" class="err"></p>
  </div>
  <script>
    (function () {
      var payload = ${payloadJson};
      function notify(type, detail) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, detail: detail || {} }));
          }
        } catch (e) {}
      }
      function showErr(msg) {
        var el = document.getElementById('err');
        if (el) el.textContent = msg || 'Could not open payment gateway';
        notify('error', { message: msg });
      }
      try {
        if (typeof $ === 'undefined') {
          showErr('Payment SDK failed to load (jQuery). Check your network connection.');
          return;
        }
        if (!$.pnCheckout) {
          showErr('Payment SDK failed to load (checkout). Check your network connection.');
          return;
        }
        $.pnCheckout(payload);
        notify('opened', {});
      } catch (e) {
        showErr((e && e.message) ? e.message : 'Payment checkout error');
      }
    })();
  </script>
</body>
</html>`;
}
