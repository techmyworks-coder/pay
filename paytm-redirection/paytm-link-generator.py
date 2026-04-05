#!/usr/bin/env python3
"""
Paytm Payment Deep Link Generator
Generates a WhatsApp-shareable link that opens Paytm send money screen
"""

import sys
from urllib.parse import quote

BASE_URL = "https://your-domain.com/pay/paytm"


def generate_link(phone_number, name, amount_rupees, vpa=None):
    params = f"ph={phone_number}&pn={quote(name)}&am={amount_rupees}"
    if vpa:
        params += f"&vpa={quote(vpa)}"
    return f"{BASE_URL}?{params}"


if __name__ == "__main__":
    # Default values
    phone = "9876854530"
    name = "ABHI ARORA"
    amount = 1
    vpa = None

    if len(sys.argv) > 1:
        amount = float(sys.argv[1])
    if len(sys.argv) > 2:
        phone = sys.argv[2]
    if len(sys.argv) > 3:
        name = sys.argv[3]
    if len(sys.argv) > 4:
        vpa = sys.argv[4]

    link = generate_link(phone, name, amount, vpa)
    print(f"\nPaytm Payment Link")
    print(f"To: {name} ({phone})")
    print(f"Amount: ₹{amount}")
    if vpa:
        print(f"VPA: {vpa}")
    print(f"\n{link}\n")
