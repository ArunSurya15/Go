# Passenger Notifications — Email & WhatsApp

When a booking is confirmed (Razorpay webhook fires `payment.captured`), e-GO
automatically sends the passenger:

1. **Booking confirmation email** — HTML summary (route, times, PNR, fare/GST snapshot), **PDF ticket & tax invoice attached** when generation succeeds, plus a **download link** as fallback.
2. **WhatsApp message** (only if the passenger ticked "Send on WhatsApp" during checkout).

Both are fire-and-forget — a failure never blocks the booking response.

---

## 1. Email (Resend)

### Why Resend?
- No SMTP server to manage.
- **Free tier: 3,000 emails/month, 100/day** — no credit card required to start.
- Simple REST API; no extra Python package needed (we use `urllib`).
- When you go live: $20/month for 50,000 emails, or pay-as-you-go.

### Setup

1. **Create a Resend account** → https://resend.com  
   (takes ~2 minutes; sign in with Google)

2. **Add an API Key**  
   Dashboard → API Keys → Add API Key → give it a name → copy the key.

3. **Add to `.env`**:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
   ```

4. **Verify your domain** (needed for production; not required in dev):
   - Dashboard → Domains → Add Domain → follow DNS instructions.
   - Once verified, set `EMAIL_FROM`:
     ```
     EMAIL_FROM=e-GO Tickets <noreply@yourdomain.com>
     ```
   - In development you can use `onboarding@resend.dev` as the from-address,
     but Resend only delivers to your own account email in that case.

5. **Set the app's public URL** so ticket links in emails work:
   ```
   APP_BASE_URL=https://yourdomain.com
   ```

6. **Restart the backend.** A confirmation email will be sent on the next booking.

### Testing

Book a trip in dev mode (DEMO_PAYMENTS=True). Check your email — or check
Resend → Emails dashboard to see the delivery log.

---

## 2. WhatsApp

### Two options

| Provider | Best for | Cost |
|---|---|---|
| **Twilio** | Quick start, sandbox for testing | ~₹0.75–₹1.50 / message |
| **Meta Cloud API** | Production at scale, lower cost | ~₹0.40–₹0.80 / message (business-initiated) |

You only need **one** of these. Start with Twilio — the sandbox is free.

---

### Option A: Twilio WhatsApp

**Step 1 — Create account**: https://console.twilio.com (free trial gives $15 credit)

**Step 2 — Sandbox setup** (for testing):
- Twilio Console → Messaging → Try it Out → Send a WhatsApp Message
- Follow instructions: your test phone must send "join <word>" to the sandbox number.

**Step 3 — Add to `.env`**:
```
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # sandbox number; change when you go live
```

**Going live with Twilio**: Apply for a WhatsApp Business Profile in the Twilio console.
You'll get a real Indian (+91) number or a US number. Replace `TWILIO_WHATSAPP_FROM`.

---

### Option B: Meta Cloud API (recommended for production)

**Step 1** — Go to https://developers.facebook.com → Create App → Business.

**Step 2** — Add "WhatsApp" product to your app.

**Step 3** — In WhatsApp → Getting Started:
- Note your **Phone number ID** and **Temporary access token**.
- Add a test phone number.

**Step 4 — Add to `.env`**:
```
WHATSAPP_PROVIDER=meta
META_WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxx   # from Meta dashboard (or permanent token via System User)
META_WHATSAPP_PHONE_ID=123456789012345   # Phone Number ID from Meta dashboard
```

**Going live with Meta**: Submit your app for Business Verification + WhatsApp
Business Policy review. Once approved, get a permanent system user token.

---

## 3. Opt-in

The passenger must tick **"Send booking details and trip updates on WhatsApp"**
on the checkout passenger details page. The `whatsapp_opt_in` field on `Booking`
stores this. If unchecked, WhatsApp is never sent regardless of provider settings.

Email is always sent (as long as `RESEND_API_KEY` is set and the user has an email).

---

## 4. Summary of `.env` keys

```env
# Email
RESEND_API_KEY=re_xxx
EMAIL_FROM=e-GO Tickets <noreply@yourdomain.com>
APP_BASE_URL=https://yourdomain.com

# WhatsApp (choose one provider)
WHATSAPP_PROVIDER=twilio        # or 'meta'

# Twilio keys (also used for OTP SMS)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Meta Cloud API (if using Meta instead)
META_WHATSAPP_TOKEN=EAAxxx
META_WHATSAPP_PHONE_ID=xxx
```

---

## 5. Cost estimate at launch

Assuming 500 bookings/month:

| Service | Volume | Monthly cost |
|---|---|---|
| Resend (email) | 500 emails | **₹0** (free tier) |
| Twilio WhatsApp | 400 messages (80% opt-in) | ~**₹300–₹600** |
| Meta WhatsApp | 400 messages | ~**₹160–₹320** |

Once you exceed 3,000 emails/month, Resend costs $20/month (≈₹1,670) — still very cheap.
