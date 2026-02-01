# Bus Booking Backend – Code Structure Overview

This document describes the entire codebase: folder layout, what each app and file does, how data fits together, and the main API flow.

---

## 1. Project layout

```
bus_booking/
├── backend/                    # Django project root
│   ├── backend/                # Django project config (settings, main urls)
│   ├── users/                  # Auth & custom User
│   ├── common/                 # Routes (origin → destination)
│   ├── buses/                  # Operators & Buses
│   ├── bookings/               # Schedules, Reservations, Bookings, Payments, Tickets
│   ├── manage.py
│   ├── db.sqlite3
│   ├── .env
│   └── tickets/                # Generated PDF tickets (files)
└── requirements.txt
```

- **backend/** – Where you run `manage.py`; contains all Django apps and config.
- **backend/backend/** – Project package: `settings.py`, main `urls.py`, `wsgi.py`, etc.
- **backend/users/**, **common/**, **buses/**, **bookings/** – Django apps (models, views, urls, serializers).
- **tickets/** – Directory where PDF ticket files are saved.

---

## 2. Django project config (`backend/backend/`)

| File | Role |
|------|------|
| **settings.py** | DB (SQLite), INSTALLED_APPS, REST_FRAMEWORK (JWT auth, permissions), CORS, Razorpay/Redis/Ticket env vars, `AUTH_USER_MODEL = 'users.User'`. |
| **urls.py** | Root URL routing: `admin/`, `api/users/`, `api/` (common + bookings), and API docs (`api/schema/`, `api/docs/`, `api/redoc/`). |

So: **settings** define how the app runs (auth, APIs, payments, Redis); **urls** wire `/admin/` and all `/api/` prefixes to the right apps.

---

## 3. Apps and what they do

### **users** – Authentication and users

| File | Role |
|------|------|
| **models.py** | Custom **User** (extends Django's AbstractUser): `username`, `email`, `password`, **role** (PASSENGER / OPERATOR / ADMIN). |
| **views.py** | **RegisterView** – POST to create user (AllowAny). Login/refresh come from SimpleJWT (see urls). |
| **serializers.py** | **UserRegisterSerializer** – validates and creates User (password hashing, role). |
| **urls.py** | `register/`, `login/`, `token/refresh/` under `api/users/`. |

So: **users** = "who is the user?" and "give me a JWT". Everything else that needs "current user" uses this User and JWT.

---

### **common** – Routes (origin → destination)

| File | Role |
|------|------|
| **models.py** | **Route**: `origin`, `destination`, `distance_km`. One row = one route (e.g. Bengaluru → Pondicherry). |
| **views.py** | **RouteListView** – GET list of routes, filter by query params `from` and `to` (AllowAny). |
| **serializers.py** | **RouteSerializer** – id, origin, destination, distance_km. |
| **urls.py** | `routes/` under `api/` → so **GET /api/routes/** |

So: **common** = "which routes exist?" and "search routes by from/to". No auth required.

---

### **buses** – Operators and buses

| File | Role |
|------|------|
| **models.py** | **Operator** (name, contact, kyc_status, bank_details). **Bus** (operator, registration_no, capacity, seat_map_json). No API views – used by **bookings** and Admin. |
| **admin.py** | Register Operator and Bus in Django Admin so you can create/edit them. |

So: **buses** = "who runs the bus?" and "which bus, how many seats?". Data is used when you create Schedules and when generating tickets.

---

### **bookings** – Core booking flow

This app owns the full flow: **schedules → reserve → pay → ticket**.

| File | Role |
|------|------|
| **models.py** | **Schedule** (bus + route + departure/arrival + fare). **Reservation** (schedule + seat_no + user + expires_at, temporary hold). **Booking** (user + schedule + seats + amount + status + payment_id + ticket_file). **Payment** (booking + gateway_order_id + gateway_payment_id + status + raw_response). |
| **views.py** | Implements all booking APIs (see "API endpoints" below). |
| **serializers.py** | Serializers for Schedule, Reservation, Booking, Payment (and nested Route/Bus for schedules). |
| **urls.py** | `schedules/`, `reserve/`, `create-payment/`, `payment/webhook/`, `bookings/<id>/ticket/`, `tickets/download/<id>/`. |
| **lock.py** | Redis seat lock: `try_hold_seats(schedule_id, seats, user_id)` (SET NX + TTL), `release_seats()`. If Redis is down, views fall back to DB checks. |
| **ticket_generator.py** | Builds PDF ticket: booking/journey details, QR code (with HMAC signature), saves under `tickets/`. `save_ticket_to_booking(booking)` generates file and returns filename; views set `booking.ticket_file`. |
| **management/commands/seed_demo.py** | `python manage.py seed_demo` – creates demo users, route (Bengaluru–Pondicherry), operator, bus, and sample schedules. |

So: **bookings** = "when does the bus go?", "hold these seats", "create payment order", "receive payment result", "generate and serve ticket".

---

## 4. How the data fits together (models)

- **Route** (common) – standalone (origin, destination).
- **Operator** → **Bus** (buses): one operator, many buses.
- **Bus** + **Route** → **Schedule** (bookings): "this bus on this route at this time, this fare."
- **User** (users) → **Reservation** (bookings): "this user holds this seat on this schedule until expires_at."
- **User** → **Booking** (bookings): "this user bought these seats on this schedule for this amount."
- **Booking** → **Payment** (bookings): one-to-one, stores Razorpay order_id/payment_id and raw webhook.

So: **Route + Bus + Schedule** describe "what can be booked"; **Reservation** is temporary hold; **Booking + Payment** are the confirmed purchase and payment record; **ticket_file** on Booking points to the generated PDF.

---

## 5. API endpoints (what does what)

All under `backend/`, so base URL is e.g. `http://127.0.0.1:8000`.

| Method | URL | Auth | What it does |
|--------|-----|------|----------------|
| POST | **/api/users/register/** | No | Create user (username, email, password, role). |
| POST | **/api/users/login/** | No | Return JWT `access` and `refresh`. |
| POST | **/api/users/token/refresh/** | No | Return new `access` from `refresh`. |
| GET | **/api/routes/** | No | List routes; query `from` and `to` to filter. |
| GET | **/api/schedules/** | No | List schedules; query `route_id` and `date` to filter. |
| POST | **/api/reserve/** | JWT | Hold seats: body `schedule_id`, `seats[]`. Uses Redis lock if available, else DB. Returns reservation_ids and TTL. |
| POST | **/api/create-payment/** | JWT | Create Booking (PENDING) and Razorpay order (or demo order). Body: `schedule_id`, `seats[]`, `amount`. Returns `order_id`, `key_id`, `amount`, `currency` for Checkout. |
| POST | **/api/payment/webhook/** | No | Razorpay calls this. Verifies signature, finds Payment by order_id, marks success/fail, confirms booking and releases reservations; can generate ticket PDF. |
| GET | **/api/bookings/<id>/ticket/** | JWT | Returns JSON with `ticket_url`. If no PDF yet, generates it and sets `booking.ticket_file`. |
| GET | **/api/tickets/download/<id>/** | JWT | Serves the PDF file for that booking (same id as booking). |
| GET | **/api/schema/** | No | OpenAPI schema. |
| GET | **/api/docs/** | No | Swagger UI. |
| GET | **/api/redoc/** | No | ReDoc. |

So: **users** = register/login/refresh; **common** = routes; **bookings** = schedules, reserve, create-payment, webhook, ticket URL, ticket download. Auth is JWT except for register, login, refresh, routes, schedules, and webhook.

---

## 6. Request flow (end-to-end)

1. **Register/Login** → get JWT (`/api/users/register/` or `/api/users/login/`).
2. **Search** → GET `/api/routes/?from=...&to=...` then GET `/api/schedules/?route_id=...&date=...`.
3. **Reserve** → POST `/api/reserve/` with JWT and `schedule_id`, `seats` → Redis (or DB) holds seats for TTL.
4. **Create payment** → POST `/api/create-payment/` with JWT and `schedule_id`, `seats`, `amount` → backend creates Booking + Razorpay order and returns order info.
5. **User pays** → Frontend opens Razorpay Checkout; user completes payment.
6. **Webhook** → Razorpay POSTs to `/api/payment/webhook/` → backend verifies signature, updates Payment and Booking, marks reservations, optionally generates PDF and sets `ticket_file`.
7. **Get ticket** → GET `/api/bookings/<id>/ticket/` (JWT) → get `ticket_url`; GET that URL (or `/api/tickets/download/<id>/`) to download the PDF.

So: **users** and **common** get you "who" and "which route/schedule"; **bookings** does "hold → pay → confirm → ticket", with **lock.py** for seats and **ticket_generator.py** for the PDF.

---

## 7. Important details

- **Auth**: Default is "authenticated required" (REST_FRAMEWORK). Register, login, refresh, routes, schedules, and webhook are AllowAny; webhook also has `authentication_classes = []` so Razorpay is never rejected by JWT.
- **Seats**: Stored as JSON text in Booking (e.g. `["1A","1B"]`) for SQLite compatibility. Reservation is per seat; Redis key is e.g. `res:{schedule_id}:{seat_no}` with TTL.
- **Payments**: If `DEMO_PAYMENTS=true` or Razorpay keys are missing, create-payment returns a demo order and you can simulate success with a manual POST to the webhook. With real keys and `DEMO_PAYMENTS=false`, real Razorpay orders and webhook verification are used.
- **Tickets**: Generated by **ticket_generator.py** (ReportLab + qrcode), saved under `backend/tickets/`, filename stored in `Booking.ticket_file`. Ticket view generates on first request if not already generated; webhook can also generate after payment success.

---

## 8. Environment variables (.env)

| Variable | Purpose |
|----------|---------|
| RAZORPAY_KEY_ID | Razorpay API Key ID (Test: rzp_test_...) |
| RAZORPAY_KEY_SECRET | Razorpay API Key Secret |
| RAZORPAY_WEBHOOK_SECRET | Webhook signing secret from Razorpay Dashboard |
| DEMO_PAYMENTS | `true` = demo orders, no Razorpay; `false` = real Razorpay |
| RAZORPAY_VERIFY_WEBHOOK | `true` = verify webhook signature; `false` = skip (dev only) |
| REDIS_URL | Redis connection URL (e.g. redis://127.0.0.1:6379/0) |

---

*Generated for Bus Booking Backend – Code Structure.*
