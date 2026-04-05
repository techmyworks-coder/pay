# Paytm Deep Link Reverse Engineering Guide

## How We Figured This Out

### Step 1: Download & Decompile the APK

Downloaded the real Paytm APK (~96MB) and decompiled it using `jadx`:

```bash
jadx -d /tmp/paytm-decompiled Paytm.apk
```

### Step 2: Find URL Schemes in AndroidManifest.xml

```bash
grep -i "scheme" resources/AndroidManifest.xml
```

Found custom schemes:
- `paytmmp://` — main deep link scheme (registered as `@string/schema_name`)
- `paytmgn://` — order/payment deep links
- `paytmscanner://` — scanner
- `paytmbankmt://` — bank money transfer
- `upi://` — standard UPI payments

### Step 3: Find Chat Deep Links in Source Code

```bash
grep -rn "paytmmp://chat" sources/ | grep -i "start_chat"
```

Found in `DiscoverySearchProvider.java`:
```java
// Chat with VPA
"paytmmp://chat?featuretype=start_chat&userType=VPA&vpa=" + vpa + "&txnCategory=VPA2VPA"

// Chat with customer (phone number)
"paytmmp://chat?featuretype=start_chat&userType=CUSTOMER&custId=" + customerId + "&custName=" + name + "&custPhone=" + phone

// Chat with merchant
"paytmmp://chat?featuretype=start_chat&userType=MERCHANT&mid=" + merchantId + "&name=" + name
```

Found in `ChatDeepLinkHandler.java`:
```java
// Chat by phone number (the one that works!)
"paytmmp://chat?featuretype=start_chat&phone=" + phoneNumber + "&phoneName=" + name

// Chat with amount parameter
// Line 914: String queryParameter = mDeepLinkUri.getQueryParameter("amount");
```

### Step 4: Find Direct Pay Deep Links

```bash
grep -rn "sendmoneymobile\|money_transfer" sources/ | grep "paytmmp"
```

Found in `CJRSplashInitLib.java`:
```java
// Direct send money (skips profile card)
"paytmmp://cash_wallet?featuretype=sendmoneymobile&recipient=" + phoneNumber

// Send money to bank account
"paytmmp://cash_wallet?featuretype=money_transfer_bankaccount"

// Send money to UPI ID
"paytmmp://cash_wallet?featuretype=money_transfer&pa=" + upiId + "&pn=" + name

// Send money to self
"paytmmp://cash_wallet?featuretype=money_transfer_self"
```

Found in `QuickPaymentActivity.java`:
```java
// Quick pay to UPI VPA
"paytmmp://cash_wallet?featuretype=money_transfer&pa=" + vpa + "&pn=" + name

// Quick pay to bank account
"paytmmp://cash_wallet?featuretype=money_transfer&account=" + account + "&pn=" + name + "&ifsc=" + ifsc
```

### Step 5: Find Amount Pre-fill Support

In `ChatDeepLinkHandler.java` line 914:
```java
String queryParameter = mDeepLinkUri.getQueryParameter("amount");
```

This confirms the `amount` parameter is supported in chat deep links.

---

## All Discovered Paytm Deep Links

### Chat Deep Links

| Deep Link | Description |
|-----------|-------------|
| `paytmmp://chat?featuretype=start_chat&phone=<phone>&phoneName=<name>` | Open chat with phone number |
| `paytmmp://chat?featuretype=start_chat&phone=<phone>&phoneName=<name>&amount=<rupees>` | Chat with amount pre-filled |
| `paytmmp://chat?featuretype=start_chat&userType=VPA&vpa=<upi_id>&txnCategory=VPA2VPA` | Chat with UPI VPA |
| `paytmmp://chat?featuretype=start_chat&userType=CUSTOMER&custPhone=<phone>&custName=<name>` | Chat with customer |
| `paytmmp://chat?featuretype=start_chat&userType=MERCHANT&mid=<merchant_id>&name=<name>` | Chat with merchant |
| `paytmmp://chat?featuretype=start_chat&groupChannelUrl=<url>` | Open group chat |
| `paytmmp://chat?featuretype=split` | Open split bill |

### Payment Deep Links

| Deep Link | Description |
|-----------|-------------|
| `paytmmp://cash_wallet?featuretype=sendmoneymobile&recipient=<phone>&amount=<rupees>` | **Direct send money (skips profile)** |
| `paytmmp://cash_wallet?featuretype=money_transfer&pa=<upi_id>&pn=<name>` | Send money via UPI ID |
| `paytmmp://cash_wallet?featuretype=money_transfer&account=<acc>&pn=<name>&ifsc=<ifsc>` | Send money via bank account |
| `paytmmp://cash_wallet?featuretype=money_transfer_self` | Send money to self |
| `paytmmp://cash_wallet?featuretype=money_transfer_bankaccount` | Send to bank account screen |
| `paytmmp://upi/pay?pa=<upi_id>&pn=<name>&am=<amount>&cu=INR` | UPI pay (standard format) |

### Other Deep Links

| Deep Link | Description |
|-----------|-------------|
| `paytmmp://login?screen=setAppLock` | Set app lock |
| `paytmmp://clipboard` | Clipboard handler |
| `paytmmp://mini-app?aId=<app_id>` | Open mini app |
| `paytmmp://accept_money?featuretype=ump-web&url=<dashboard_url>` | Accept money settings |
| `paytmmp://upi?featuretype=biometric_setting` | UPI biometric settings |
| `paytmgn://paytm.com/order_summary` | Order summary |
| `paytmgn://paytm.com/homepage` | Homepage |

---

## Working Payment Flows

### Flow 1: Chat with Amount (Shows Profile Card + "Send ₹X" Button)

```
paytmmp://chat?featuretype=start_chat&phone=9876854530&phoneName=ABHI+ARORA&amount=1&source=deeplink
```

**Result:** Opens profile card with:
- Contact name & phone
- Bank verified name
- "Pay Now" button
- "Send ₹1" button (amount pre-filled)

### Flow 2: Direct Send Money (Skips Profile Card)

```
paytmmp://cash_wallet?featuretype=sendmoneymobile&recipient=9876854530&amount=1
```

**Result:** Goes directly to send money / enter amount screen, skipping the profile card.

### Flow 3: UPI Pay (Standard)

```
paytmmp://upi/pay?pa=pradyut@idfcbank&pn=ABHI+ARORA&am=1&cu=INR
```

**Result:** Opens standard UPI payment screen.

---

## Shareable WhatsApp Payment Link (ptm.html)

### The Problem
- `paytmmp://` links get stripped by WhatsApp
- Paytm has no verified `https://` app link wrapper like PhonePe

### The Solution
A static HTML redirect page hosted on GitHub Pages that tries multiple Paytm deep link methods.

### URL Format

```
https://your-domain.com/pay/paytm?ph=<phone>&pn=<name>&am=<amount>&vpa=<upi_id>
```

| Param | Description | Example |
|-------|-------------|---------|
| `ph` | Receiver's phone number | `9876854530` |
| `pn` | Receiver's display name | `ABHI+ARORA` |
| `am` | Amount in rupees | `1`, `10`, `500` |
| `vpa` | UPI VPA (optional) | `pradyut@idfcbank` |

### Examples

```
# ₹1 payment
https://your-domain.com/pay/paytm?ph=9876854530&pn=ABHI+ARORA&am=1

# ₹10 payment  
https://your-domain.com/pay/paytm?ph=9876854530&pn=ABHI+ARORA&am=10

# ₹500 payment with VPA
https://your-domain.com/pay/paytm?ph=9876854530&pn=ABHI+ARORA&am=500&vpa=pradyut@idfcbank

# Different person
https://your-domain.com/pay/paytm?ph=9999999999&pn=JOHN+DOE&am=100
```

### How ptm.html Works

1. **Reads URL params** (`ph`, `pn`, `am`, `vpa`)
2. **Tries 3 redirect methods** with 2-second gaps:
   - `paytmmp://cash_wallet?featuretype=sendmoneymobile&recipient=<phone>&amount=<am>` (direct pay)
   - `paytmmp://chat?featuretype=start_chat&phone=<phone>&phoneName=<name>&amount=<am>` (chat with amount)
   - `intent://cash_wallet?...#Intent;scheme=paytmmp;package=net.one97.paytm;end` (Android intent fallback)
3. **Shows manual buttons** after 5 seconds if nothing opened

### Hosting
- **GitHub Pages**: `https://your-domain.com/pay/paytm`
- **Production**: Add `ptm.html` to `velora-repos/velora-user/public/`

---

## Key Differences: PhonePe vs Paytm Deep Links

| Feature | PhonePe | Paytm |
|---------|---------|-------|
| Custom scheme | `phonepe://native?id=<screen>&data=<base64>` | `paytmmp://<path>?<params>` |
| Data encoding | Base64 JSON in `data` param | Query string params directly |
| App link wrapper | `https://www.phonepe.com/applink?landing_page=...` | None (no verified app link) |
| Chat with contact | `id=p2pContactChat` with `contactInfo` object | `featuretype=start_chat&phone=...` |
| Amount pre-fill | `sendParams.initialAmount` (in paise) | `amount=` param (in rupees) |
| Direct pay | Not available (goes through chat) | `featuretype=sendmoneymobile&recipient=...` |
| Package name | `com.phonepe.app` | `net.one97.paytm` |

---

## Reverse Engineering Methodology

1. **Download APK** from the phone using APK Extractor app
2. **Decompile** with `jadx -d output/ app.apk`
3. **Search AndroidManifest.xml** for `scheme=`, `host=`, `pathPrefix=` to find URL schemes
4. **Search source code** for scheme URLs (`grep -rn "paytmmp://" sources/`)
5. **Find deep link handler** class (usually `DeepLinkActivity` or `DeepLinkHandler`)
6. **Trace parameter handling** — find what query params are read (`getQueryParameter`)
7. **Find data models** — classes like `ChatLaunchOption`, `SendTabParams` that define the payload
8. **Test** by building redirect HTML pages and sharing via WhatsApp
