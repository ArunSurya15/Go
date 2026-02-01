# Operator OTP & SMS Setup

Operators can **register** (self-signup) and optionally **verify mobile** with OTP. SMS is sent only when a provider is configured; otherwise OTP is logged for dev.

---

## 1. Operator registration (no OTP required)

- **POST /api/users/register-operator/**  
  Body: `username`, `password`, `company_name`, optional `email`, `phone`, `owner_name`.  
  Creates an **Operator** and a **User** (role=OPERATOR) linked to it. No admin step needed to create the account; admin can still approve KYC/schedules later.

- **Frontend:** `/operator/register` – form with company name, owner name, username, email, mobile, password. Optional “Verify mobile” with OTP before or after registration.

---

## 2. OTP endpoints (optional verification)

- **POST /api/users/send-otp/**  
  Body: `{ "mobile": "+919876543210" }`.  
  Generates a 6-digit OTP, stores it in cache (5 min TTL), and optionally sends SMS.  
  Response: `{ "detail": "OTP sent to your mobile." }` or dev hint.

- **POST /api/users/verify-otp/**  
  Body: `{ "mobile": "+919876543210", "otp": "123456" }`.  
  Verifies OTP and deletes it from cache.  
  Response: `{ "detail": "Verified.", "verified": true }`.

---

## 3. Sending real SMS (Twilio or MSG91)

### Option A: Twilio

1. Sign up at [twilio.com](https://www.twilio.com) and get Account SID, Auth Token, and a phone number.
2. In `.env`:
   ```
   SMS_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1234567890
   ```
3. Install: `pip install twilio` (add to requirements.txt if needed).
4. Restart backend. Operator “Send OTP” will send real SMS via Twilio.

### Option B: MSG91 (India)

1. Sign up at [msg91.com](https://msg91.com) and get Auth Key. Configure an OTP template.
2. In `.env`:
   ```
   SMS_PROVIDER=msg91
   MSG91_AUTH_KEY=...
   MSG91_SENDER_ID=e-GO
   ```
3. The current code has a placeholder for MSG91; you may need to adjust `users/otp.py` to match their OTP API (template_id, request format). See [MSG91 OTP API](https://docs.msg91.com/p/otp-api).

### No provider (dev)

- Leave `SMS_PROVIDER` unset or empty. OTP is **logged** (e.g. “OTP (dev, no SMS): to=+91999... message=...”). Use that OTP in “Verify” for testing.

---

## 4. Settings (backend)

In `settings.py` (or env):

- `SMS_PROVIDER` – `''`, `twilio`, or `msg91`
- `OTP_TTL_SECONDS` – default 300 (5 min)
- `OTP_LENGTH` – default 6
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- MSG91: `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`

---

## 5. User.phone

- **User.phone** is stored (optional). Used for OTP and future “login with mobile” (lookup user by phone, verify OTP, issue JWT). Migration: `users.0003_user_phone`.
