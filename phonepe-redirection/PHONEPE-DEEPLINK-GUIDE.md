# PhonePe Deep Link Reverse Engineering Guide

## How We Figured This Out

### Step 1: Download & Decompile the APK

Downloaded the real PhonePe APK (~145MB) and decompiled it using `jadx`:

```bash
brew install jadx
jadx -d /tmp/phonepe-decompiled PhonePe.apk
```

This gives us:
- `resources/AndroidManifest.xml` — all activities, intent filters, URL schemes
- `sources/` — decompiled Java source code

---

### Step 2: Find URL Schemes in AndroidManifest.xml

Searched for all registered URL schemes:

```bash
grep -i "scheme" resources/AndroidManifest.xml
```

Found:
- `upi://pay` — standard UPI payment
- `phonepe://` — PhonePe custom scheme (handled by `DeepLinkHandlerActivity`)
- `ppe://` — alternate PhonePe scheme
- `https://www.phonepe.com/applink` — verified app link (auto-opens app from browser)

---

### Step 3: Discover the `phonepe://native` Deep Link System

Searched source code for all `phonepe://` URLs:

```bash
grep -rn "phonepe://" sources/ | grep -v ".class"
```

Found PhonePe uses a generic deep link format:
```
phonepe://native?id=<screen_id>&data=<base64_json>
```

The `DeepLinkHandlerActivity` routes to different screens based on the `id` parameter.

---

### Step 4: Find Chat-Related Activities

Searched manifest for chat activities:

```bash
grep -i "chat\|message\|p2p" AndroidManifest.xml
```

Found:
- `Navigator_ChatActivity` — individual chat screen
- `Navigator_P2PMainActivity` — P2P main screen with chat list
- `Navigator_GroupActivity` — group chat

Key finding: **None of these had intent-filters** — meaning they can't be opened directly via URL. They're internal-only.

---

### Step 5: Find How Chat is Opened Internally

Searched for code that launches chat:

```bash
grep -rn "Navigator_ChatActivity\|Navigator_P2PMainActivity" sources/ | grep "intent\|launch\|start"
```

Found in `Navigator.java`:
```java
if (name.equals("chat_activity")) {
    Intent intent = new Intent(context, Navigator_ChatActivity.class);
    context.startActivity(intent);
}
```

---

### Step 6: Discover `p2pContactChat` Screen ID

Searched for UriData constructors that reference chat:

```bash
grep -rn "UriData" sources/ | grep "chat\|p2p"
```

Found in `ChatNavigationProvider.java`:
```java
return this.c.a(new UriData("p2pContactChat", str, analyticsData, 8));
```

And in `ContactNewOnPhonepeNotificationHelper.java`:
```java
uri = intentNativeUriHelper.a(new UriData("p2pContactChat", gson.toJson(p2PChatUIParams), analyticsData, 8));
```

This told us the screen ID is `p2pContactChat` and it takes `P2PChatUIParams` as base64-encoded JSON data.

---

### Step 7: Reverse Engineer P2PChatUIParams

Found the class at `com/phonepe/chat/contract/models/P2PChatUIParams.java`:

```java
@SerializedName("contactInfo") private Contact contact;
@SerializedName("initialTab") private String initialTab;
@SerializedName("sendParams") private SendTabParams sendParams;
@SerializedName("withSheetExpanded") private boolean withSheetExpanded;
@SerializedName("shouldAutoShowKeyboard") private boolean shouldAutoShowKeyboard;
@SerializedName("validateDestination") private Boolean shouldValidateDestination;
```

---

### Step 8: Reverse Engineer Contact & SendTabParams

**PhoneContact.java** (extends Contact):
```java
@SerializedName("type") private final ContactType type;        // "PHONE"
@SerializedName("name") private final String name;              // Display name
@SerializedName("phoneNumber") private final String phoneNumber; // Phone number
@SerializedName("isOnPhonePe") private final boolean isOnPhonePe;
@SerializedName("isUpiEnabled") private final boolean isUpiEnabled;
@SerializedName("externalVpaAvailable") private final boolean hasExternalVpa;
```

**SendTabParams.java**:
```java
@SerializedName("initialAmount") private final long initialAmount; // Amount in PAISE
@SerializedName("note") private final String note;                  // Payment note
@SerializedName("destination") private final Destination destination;
@SerializedName("payContext") private final PayContext payContext;
```

---

### Step 9: Discover the App Link Wrapper

From AndroidManifest.xml:
```xml
<intent-filter android:autoVerify="true">
    <data android:scheme="https"
          android:host="www.phonepe.com"
          android:pathPrefix="/applink"/>
</intent-filter>
```

From `DeeplinkUtils.java`:
```java
if (uri.toString().startsWith("https://www.phonepe.com/applink")) {
    return Uri.parse(uri.getQueryParameter("landing_page"));
}
```

This means `https://www.phonepe.com/applink?landing_page=<phonepe://...>` automatically opens PhonePe and redirects to the internal deep link. This is the **key discovery** — it converts an https:// URL (shareable on WhatsApp) into an internal phonepe:// deep link.

---

### Step 10: Assemble the Final URL

#### The JSON payload:
```json
{
  "contactInfo": {
    "type": "PHONE",
    "name": "ABHI ARORA",
    "phoneNumber": "9876854530",
    "isOnPhonePe": true,
    "isUpiEnabled": true,
    "hasExternalVpa": false
  },
  "withSheetExpanded": true,
  "shouldShowUnsavedBanner": false,
  "shouldAutoShowKeyboard": true,
  "initialTab": "SEND",
  "sendParams": {
    "initialAmount": 100,
    "note": "Payment"
  },
  "validateDestination": false
}
```

#### Encoding steps:
1. JSON → string
2. String → Base64 encode
3. Build: `phonepe://native?id=p2pContactChat&data=<base64>`
4. URL-encode the whole thing
5. Wrap: `https://www.phonepe.com/applink?landing_page=<url-encoded>`

#### Python generator:
```python
import json, base64
from urllib.parse import quote

data = { ... }  # JSON above
encoded = base64.b64encode(json.dumps(data).encode()).decode()
landing = f"phonepe://native?id=p2pContactChat&data={encoded}"
url = f"https://www.phonepe.com/applink?landing_page={quote(landing)}"
```

---

## All Discovered PhonePe Native Screen IDs

| Screen ID | Description |
|-----------|-------------|
| `p2pContactChat` | Open chat with specific contact |
| `p2pOnlyContactsChat` | Open chat contacts list |
| `p2pGangContactChat` | Open group chat |
| `p2pPaymentContactPicker` | Open send money contact picker |
| `p2pContactPicker` | Open contact picker |
| `upiLite` | UPI Lite screen |
| `recharge` | Mobile recharge |
| `billPay` | Bill payment |
| `lockerDetails` | DigiLocker |
| `insuranceHomePage` | Insurance |
| `creditHomePage` | Credit/Loans |
| `dailySavings` | Gold SIP |
| `webView` | Open URL in PhonePe WebView |
| `alertTab` | Notifications/Alerts |
| `checkBalanceV1` | Check bank balance |
| `upiCircleManagement` | UPI Circle settings |
| `sendMoney` | Send money flow |
| `accountTransfer` | Account transfer |

---

## Key Fields Reference

### P2PChatUIParams
| Field | Type | Description |
|-------|------|-------------|
| `contactInfo` | Object | Contact details (see below) |
| `withSheetExpanded` | boolean | Show payment sheet expanded |
| `shouldShowUnsavedBanner` | boolean | Show "not in contacts" banner |
| `shouldAutoShowKeyboard` | boolean | Auto-show keyboard |
| `initialTab` | string | `"SEND"` or `"REQUEST"` |
| `sendParams` | Object | Pre-fill payment details |
| `validateDestination` | boolean | Skip account type validation |
| `topicId` | string | Chat topic/thread ID |
| `origin` | string | Analytics origin |

### contactInfo (PhoneContact)
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"PHONE"` |
| `name` | string | Display name |
| `phoneNumber` | string | Phone number (10 digits) |
| `isOnPhonePe` | boolean | User is on PhonePe |
| `isUpiEnabled` | boolean | UPI is enabled |
| `hasExternalVpa` | boolean | Has external VPA |

### sendParams (SendTabParams)
| Field | Type | Description |
|-------|------|-------------|
| `initialAmount` | long | Amount in **paise** (100 = ₹1) |
| `note` | string | Payment note/remark |
| `destination` | Object | Payment destination details |
| `payContext` | Object | Payment context |

---

## Quick Examples

### ₹1 payment to 9876854530:
```bash
python3 phonepe-link-generator.py 1 9876854530 "ABHI ARORA"
```

### ₹500 payment to different number:
```bash
python3 phonepe-link-generator.py 500 9999999999 "JOHN DOE"
```

### Just open chat (no amount):
Remove `sendParams` and `initialTab` from the JSON, then encode.

---

## Shareable WhatsApp Payment Link (pp.html)

### The Problem
- `phonepe://` links get stripped by WhatsApp — only `https://` works
- `https://www.phonepe.com/applink?...` doesn't work on all phones (app link verification varies)

### The Solution
A simple HTML redirect page (`pp.html`) hosted on any web server that tries multiple methods to open PhonePe.

### How It Works

```
WhatsApp link (https://)
  → Web server (ngrok / your domain)
    → pp.html (static HTML page)
      → Tries 3 redirect methods automatically:
        1. https://www.phonepe.com/applink?landing_page=... (verified app link)
        2. phonepe://native?id=p2pContactChat&data=... (direct scheme)
        3. intent://...#Intent;scheme=phonepe;package=com.phonepe.app;end (Android intent)
      → PhonePe opens → P2P Chat with contact + amount pre-filled
```

### URL Format

```
https://<your-domain>/pp.html?ph=<phone>&pn=<name>&am=<amount>
```

| Param | Description | Example |
|-------|-------------|---------|
| `ph` | Receiver's phone number | `9876854530` |
| `pn` | Receiver's display name | `ABHI+ARORA` |
| `am` | Amount in rupees | `1`, `10`, `500` |

### Examples

```
# ₹1 payment
https://your-domain.com/pp.html?ph=9876854530&pn=ABHI+ARORA&am=1

# ₹10 payment
https://your-domain.com/pp.html?ph=9876854530&pn=ABHI+ARORA&am=10

# ₹500 payment
https://your-domain.com/pp.html?ph=9876854530&pn=ABHI+ARORA&am=500

# Different person
https://your-domain.com/pp.html?ph=9999999999&pn=JOHN+DOE&am=100
```

### How pp.html Works Internally

1. **Reads URL params** (`ph`, `pn`, `am`)
2. **Builds JSON payload** (same P2PChatUIParams structure):
```javascript
var data = {
  contactInfo: {
    type: "PHONE",
    name: name,         // from ?pn=
    phoneNumber: phone, // from ?ph=
    isOnPhonePe: true,
    isUpiEnabled: true,
    hasExternalVpa: false
  },
  withSheetExpanded: true,
  shouldShowUnsavedBanner: false,
  shouldAutoShowKeyboard: true,
  initialTab: "SEND",
  sendParams: {
    initialAmount: amountInPaise, // from ?am= × 100
    note: "Payment"
  },
  validateDestination: false
};
```
3. **Base64 encodes**: `btoa(JSON.stringify(data))`
4. **Builds deep link**: `phonepe://native?id=p2pContactChat&data=<base64>`
5. **Tries 3 redirect methods** with 2-second gaps:
   - App link: `https://www.phonepe.com/applink?landing_page=<encoded>`
   - Direct: `phonepe://native?id=p2pContactChat&data=<base64>`
   - Intent: `intent://native?id=p2pContactChat&data=<base64>#Intent;scheme=phonepe;package=com.phonepe.app;end`
6. **Shows fallback buttons** after 5 seconds if nothing opened

### Where to Host
- **Development**: ngrok (`ngrok http 5173`)
- **Production**: Any static file host — Vercel, Netlify, S3, or your own server
- The file is at `velora-repos/velora-user/public/pp.html`

### File Location
```
velora-repos/velora-user/public/pp.html
```

---

## Paytm Deep Link (Bonus)

### Discovered Deep Links from Paytm APK

**Chat with customer (by phone):**
```
paytmmp://chat?featuretype=start_chat&userType=CUSTOMER&custPhone=9876854530&custName=ABHI+ARORA&source=deeplink
```

**Chat with VPA:**
```
paytmmp://chat?featuretype=start_chat&userType=VPA&vpa=pradyut@idfcbank&txnCategory=VPA2VPA&source=deeplink
```

**Send money to UPI ID:**
```
paytmmp://cash_wallet?featuretype=money_transfer&pa=pradyut@idfcbank&pn=ABHI+ARORA
```

**Send money via UPI pay:**
```
paytmmp://upi/pay?pa=pradyut@idfcbank&pn=ABHI+ARORA&am=1&cu=INR
```

### Paytm Redirect Page
File: `velora-repos/velora-user/public/paytm-chat.html`

```
https://your-domain.com/paytm-chat.html?vpa=pradyut@idfcbank&pn=ABHI+ARORA&am=1
```

Note: Paytm doesn't have a verified `https://` app link wrapper like PhonePe, so the redirect page uses `paytmmp://` scheme directly.




https://your-domain.com/pay/phonepe?ph=9876854530&pn=ABHI+ARORA&am=1
deployed url: https://your-domain.com/pay/phonepe?ph=9876854530&pn=ABHI+ARORA&am=1

