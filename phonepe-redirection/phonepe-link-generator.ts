/**
 * PhonePe Payment Link Generator
 * Self-contained — generates deep links and redirect HTML, no external dependency
 *
 * Usage:
 *   import { generatePhonePeDeepLinks, generatePhonePeRedirectHTML } from './phonepe-link-generator';
 *
 *   // Get raw deep links
 *   const links = generatePhonePeDeepLinks({ phone: '9876854530', name: 'ABHI ARORA', amount: 1 });
 *   console.log(links.native);
 *
 *   // Generate a self-contained HTML redirect page
 *   const html = generatePhonePeRedirectHTML({ phone: '9876854530', name: 'ABHI ARORA', amount: 1 });
 *   // Serve this HTML at any URL and share on WhatsApp
 */

interface PhonePeLinkParams {
  phone: string;
  name: string;
  amount: number;
}

/**
 * Build the P2PChatUIParams JSON (PhonePe's internal data structure)
 */
function buildP2PChatData(params: PhonePeLinkParams) {
  const amountPaise = Math.round(params.amount * 100);
  return {
    contactInfo: {
      type: "PHONE",
      name: params.name,
      phoneNumber: params.phone,
      isOnPhonePe: true,
      isUpiEnabled: true,
      hasExternalVpa: false,
    },
    withSheetExpanded: true,
    shouldShowUnsavedBanner: false,
    shouldAutoShowKeyboard: true,
    initialTab: "SEND",
    sendParams: {
      initialAmount: amountPaise,
      note: "Payment",
    },
    validateDestination: false,
  };
}

/**
 * Generate raw PhonePe deep links
 */
export function generatePhonePeDeepLinks(params: PhonePeLinkParams) {
  const data = buildP2PChatData(params);
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64");
  const nativeLink = `phonepe://native?id=p2pContactChat&data=${b64}`;

  return {
    // PhonePe internal deep link (opens chat with contact + amount)
    native: nativeLink,

    // Verified app link (auto-opens PhonePe on some phones)
    appLink: `https://www.phonepe.com/applink?landing_page=${encodeURIComponent(nativeLink)}`,

    // Android intent (most reliable on Android)
    intent: `intent://native?id=p2pContactChat&data=${b64}#Intent;scheme=phonepe;package=com.phonepe.app;end`,
  };
}

/**
 * Generate a self-contained HTML page that redirects to PhonePe
 * Host this at any URL and share on WhatsApp
 */
export function generatePhonePeRedirectHTML(params: PhonePeLinkParams): string {
  const { phone, name, amount } = params;
  const amountPaise = Math.round(amount * 100);

  // The JSON data is built client-side in the HTML using btoa()
  // This avoids encoding issues with server-side base64

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pay via PhonePe</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #1a0533; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { text-align: center; max-width: 320px; }
  .logo { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #5f259f, #7b3fe4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 16px; }
  .spinner { width: 32px; height: 32px; border: 3px solid #ffffff20; border-top-color: #7b3fe4; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 16px auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { color: #ffffff80; font-size: 14px; margin: 8px 0; }
  .btn { display: block; width: 100%; padding: 14px; margin: 8px 0; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; }
  .btn-primary { background: linear-gradient(135deg, #5f259f, #7b3fe4); color: white; }
  .btn-secondary { background: #ffffff15; color: #fff; border: 1px solid #ffffff30; }
  .hidden { display: none; }
  .amount { font-size: 36px; font-weight: 800; margin: 8px 0; }
  .to { font-size: 13px; color: #ffffff60; }
</style>
<script>
  var data = {
    contactInfo: { type: "PHONE", name: "${name.replace(/"/g, '\\"')}", phoneNumber: "${phone}", isOnPhonePe: true, isUpiEnabled: true, hasExternalVpa: false },
    withSheetExpanded: true,
    shouldShowUnsavedBanner: false,
    shouldAutoShowKeyboard: true,
    initialTab: "SEND",
    sendParams: { initialAmount: ${amountPaise}, note: "Payment" },
    validateDestination: false
  };
  var b64 = btoa(JSON.stringify(data));
  var nativeLink = 'phonepe://native?id=p2pContactChat&data=' + b64;
  var appLink = 'https://www.phonepe.com/applink?landing_page=' + encodeURIComponent(nativeLink);
  var intentLink = 'intent://native?id=p2pContactChat&data=' + b64 + '#Intent;scheme=phonepe;package=com.phonepe.app;end';

  var links = [intentLink, nativeLink, appLink];
  var tried = 0;
  function tryOpen(i) { if (i !== undefined) { window.location.href = links[i]; } else if (tried < links.length) { window.location.href = links[tried]; tried++; } }

  window.onload = function() {
    tryOpen();
    setTimeout(function() { tryOpen(); }, 2000);
    setTimeout(function() { tryOpen(); }, 4000);
    setTimeout(function() {
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('status').textContent = 'PhonePe did not open?';
      document.getElementById('buttons').classList.remove('hidden');
    }, 5000);
  };
</script>
</head>
<body>
<div class="card">
  <div class="logo">PhonePe</div>
  <div class="amount">\\u20B9${amount}</div>
  <div class="to">Pay to <strong>${name}</strong></div>
  <div class="spinner" id="spinner"></div>
  <div class="status" id="status">Opening PhonePe...</div>
  <div id="buttons" class="hidden">
    <a class="btn btn-primary" href="#" onclick="tryOpen(0);return false;">Open PhonePe</a>
    <a class="btn btn-secondary" href="#" onclick="tryOpen(1);return false;">Try Direct</a>
    <a class="btn btn-secondary" href="#" onclick="tryOpen(2);return false;">Try App Link</a>
  </div>
</div>
</body>
</html>`;
}

// --- Express route examples ---
//
// import { Router } from 'express';
// import { generatePhonePeDeepLinks, generatePhonePeRedirectHTML } from './phonepe-link-generator';
//
// const router = Router();
//
// // API: Get deep links as JSON
// router.get('/api/payment/phonepe-links', (req, res) => {
//   const { phone, name, amount } = req.query;
//   if (!phone || !name || !amount) {
//     return res.status(400).json({ error: 'phone, name, amount required' });
//   }
//   const links = generatePhonePeDeepLinks({
//     phone: String(phone),
//     name: String(name),
//     amount: Number(amount),
//   });
//   res.json({ success: true, links });
// });
//
// // Serve redirect HTML page
// router.get('/pay/phonepe', (req, res) => {
//   const { phone, name, amount } = req.query;
//   if (!phone || !name || !amount) {
//     return res.status(400).send('Missing params: phone, name, amount');
//   }
//   const html = generatePhonePeRedirectHTML({
//     phone: String(phone),
//     name: String(name),
//     amount: Number(amount),
//   });
//   res.setHeader('Content-Type', 'text/html');
//   res.send(html);
// });
