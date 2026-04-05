#!/usr/bin/env python3
"""
PhonePe Payment Deep Link Generator
Generates a WhatsApp-shareable link that opens PhonePe chat & pay screen
"""

import json, base64, sys
from urllib.parse import quote

def generate_link(phone_number, name, amount_rupees, note="Payment"):
    data = {
        "contactInfo": {
            "type": "PHONE",
            "name": name,
            "phoneNumber": phone_number,
            "isOnPhonePe": True,
            "isUpiEnabled": True,
            "hasExternalVpa": False
        },
        "withSheetExpanded": True,
        "shouldShowUnsavedBanner": False,
        "shouldAutoShowKeyboard": True,
        "initialTab": "SEND",
        "sendParams": {
            "initialAmount": int(amount_rupees * 100),  # Convert to paise
            "note": note
        },
        "validateDestination": False
    }

    encoded = base64.b64encode(json.dumps(data).encode()).decode()
    landing = f"phonepe://native?id=p2pContactChat&data={encoded}"
    return f"https://www.phonepe.com/applink?landing_page={quote(landing)}"


if __name__ == "__main__":
    # Default values
    phone = "9876854530"
    name = "ABHI ARORA"
    amount = 1

    if len(sys.argv) > 1:
        amount = float(sys.argv[1])
    if len(sys.argv) > 2:
        phone = sys.argv[2]
    if len(sys.argv) > 3:
        name = sys.argv[3]

    link = generate_link(phone, name, amount)
    print(f"\nPhonePe Payment Link")
    print(f"To: {name} ({phone})")
    print(f"Amount: ₹{amount}")
    print(f"\n{link}\n")
