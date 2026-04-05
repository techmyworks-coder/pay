/**
 * Paytm Payment Link Generator
 * Self-contained — generates the deep link directly, no external dependency
 *
 * Usage:
 *   import { generatePaytmDeepLinks, generatePaytmRedirectHTML } from './paytm-link-generator';
 *
 *   // Get raw deep links
 *   const links = generatePaytmDeepLinks({ phone: '9876854530', name: 'ABHI ARORA', amount: 1 });
 *   console.log(links.directPay);
 *
 *   // Generate a self-contained HTML redirect page
 *   const html = generatePaytmRedirectHTML({ phone: '9876854530', name: 'ABHI ARORA', amount: 1 });
 *   // Serve this HTML at any URL and share on WhatsApp
 */

interface PaytmLinkParams {
  phone: string;
  name: string;
  amount: number;
  vpa?: string;
}

/**
 * Generate raw Paytm deep links
 */
export function generatePaytmDeepLinks(params: PaytmLinkParams) {
  const { phone, name, amount, vpa } = params;
  const encodedName = encodeURIComponent(name);

  return {
    // Skips profile card, goes straight to send money
    directPay: `paytmmp://cash_wallet?featuretype=sendmoneymobile&recipient=${phone}&amount=${amount}`,

    // Opens chat with amount pre-filled (shows profile card + "Send ₹X" button)
    chat: `paytmmp://chat?featuretype=start_chat&phone=${phone}&phoneName=${encodedName}&amount=${amount}&source=deeplink`,

    // Chat with VPA
    chatVpa: vpa
      ? `paytmmp://chat?featuretype=start_chat&userType=VPA&vpa=${vpa}&txnCategory=VPA2VPA&amount=${amount}&source=deeplink`
      : null,

    // Standard UPI pay
    upiPay: `paytmmp://upi/pay?pa=${vpa || phone + "@paytm"}&pn=${encodedName}&am=${amount}&cu=INR`,

    // Send money via UPI ID
    moneyTransfer: vpa
      ? `paytmmp://cash_wallet?featuretype=money_transfer&pa=${vpa}&pn=${encodedName}&amount=${amount}`
      : null,

    // Android intent (fallback)
    intent: `intent://cash_wallet?featuretype=sendmoneymobile&recipient=${phone}&amount=${amount}#Intent;scheme=paytmmp;package=net.one97.paytm;end`,
  };
}

/**
 * Generate a self-contained HTML page that redirects to Paytm
 * Host this at any URL and share on WhatsApp
 */
export function generatePaytmRedirectHTML(params: PaytmLinkParams): string {
  const { phone, name, amount, vpa } = params;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pay via Paytm</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #00295e; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { text-align: center; max-width: 320px; }
  .logo { font-size: 28px; font-weight: 800; color: #00b9f5; margin-bottom: 16px; }
  .spinner { width: 32px; height: 32px; border: 3px solid #ffffff20; border-top-color: #00b9f5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 16px auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { color: #ffffff80; font-size: 14px; margin: 8px 0; }
  .amount { font-size: 36px; font-weight: 800; margin: 8px 0; }
  .to { font-size: 13px; color: #ffffff60; }
  .btn { display: block; width: 100%; padding: 14px; margin: 8px 0; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; }
  .btn-primary { background: #00b9f5; color: white; }
  .btn-secondary { background: #ffffff15; color: #fff; border: 1px solid #ffffff30; }
  .hidden { display: none; }
</style>
<script>
  var links = [
    'paytmmp://cash_wallet?featuretype=sendmoneymobile&recipient=${phone}&amount=${amount}',
    'paytmmp://chat?featuretype=start_chat&phone=${phone}&phoneName=${encodeURIComponent(name)}&amount=${amount}&source=deeplink',
    'intent://cash_wallet?featuretype=sendmoneymobile&recipient=${phone}&amount=${amount}#Intent;scheme=paytmmp;package=net.one97.paytm;end'
  ];
  var tried = 0;
  function tryOpen() { if (tried < links.length) { window.location.href = links[tried]; tried++; } }
  window.onload = function() {
    tryOpen();
    setTimeout(tryOpen, 2000);
    setTimeout(tryOpen, 4000);
    setTimeout(function() {
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('status').textContent = 'Paytm did not open?';
      document.getElementById('buttons').classList.remove('hidden');
    }, 5000);
  };
</script>
</head>
<body>
<div class="card">
  <div class="logo">Paytm</div>
  <div class="amount">\\u20B9${amount}</div>
  <div class="to">Pay to <strong>${name}</strong></div>
  <div class="spinner" id="spinner"></div>
  <div class="status" id="status">Opening Paytm...</div>
  <div id="buttons" class="hidden">
    <a class="btn btn-primary" href="#" onclick="tried=0;tryOpen();return false;">Open Paytm</a>
    <a class="btn btn-secondary" href="#" onclick="tried=1;tryOpen();return false;">Try Chat</a>
  </div>
</div>
</body>
</html>`;
}

// --- Express route examples ---
//
// import { Router } from 'express';
// import { generatePaytmDeepLinks, generatePaytmRedirectHTML } from './paytm-link-generator';
//
// const router = Router();
//
// // API: Get deep links as JSON
// router.get('/api/payment/paytm-links', (req, res) => {
//   const { phone, name, amount, vpa } = req.query;
//   if (!phone || !name || !amount) {
//     return res.status(400).json({ error: 'phone, name, amount required' });
//   }
//   const links = generatePaytmDeepLinks({
//     phone: String(phone),
//     name: String(name),
//     amount: Number(amount),
//     vpa: vpa ? String(vpa) : undefined,
//   });
//   res.json({ success: true, links });
// });
//
// // Serve redirect HTML page
// router.get('/pay/paytm', (req, res) => {
//   const { phone, name, amount, vpa } = req.query;
//   if (!phone || !name || !amount) {
//     return res.status(400).send('Missing params: phone, name, amount');
//   }
//   const html = generatePaytmRedirectHTML({
//     phone: String(phone),
//     name: String(name),
//     amount: Number(amount),
//     vpa: vpa ? String(vpa) : undefined,
//   });
//   res.setHeader('Content-Type', 'text/html');
//   res.send(html);
// });
