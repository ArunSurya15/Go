# e-GO mobile (Expo)

Passenger app: **Expo SDK 54**, **expo-router**, **Plus Jakarta Sans**, **expo-blur** glass card, JWT auth, **live route search** (`/api/routes/` → `/api/schedules/`), trip list + detail shells (seat checkout next).

## Run

From the **repo root** (`E:/GO`):

```bash
npm run run-mobile
```

Or from this folder:

```bash
cd mobile
npm install
npx expo start
```

Then open **Android emulator**, **iOS simulator**, or **Expo Go** on a device.

## API ↔ backend (same database as desktop)

The mobile app **does not open the database file**. It calls **Django’s REST API** (`/api/routes/`, `/api/schedules/`, …). Whatever DB Django uses (e.g. `db.sqlite3` on your PC) is what you’re querying.

### Dev defaults (`lib/config.ts`)

1. **`EXPO_PUBLIC_API_URL` in `mobile/.env`** — if set, always used (best for production or odd networks).
2. **Otherwise (dev only):** infer `http://<Metro-host-IP>:8000` from Expo’s `hostUri` so a **physical phone on the same Wi‑Fi** as your PC often works **without** hand-copying a LAN IP (same trick many Expo apps use).
3. **Android emulator:** `http://10.0.2.2:8000`
4. **iOS simulator:** `http://127.0.0.1:8000`

`app.json` sets **`usesCleartextTraffic`: true** on Android so `http://…` to your LAN works in dev.

### Django must listen on all interfaces

```bash
cd bus_booking/backend
python manage.py runserver 0.0.0.0:8000
```

If search still fails, set `EXPO_PUBLIC_API_URL` explicitly (see `.env.example`). The login screen shows **Dev API:** + current base for a quick sanity check.

## Booking flow (implemented)

Search → trip list → trip detail → **Choose seats** → **Board / drop** → **Passenger details** → **Pay** (demo webhook, same as web) → **Confirmed**.

State between steps is stored in **AsyncStorage** (`ego_booking_flow_v1`), similar to the website’s `sessionStorage`.

Still optional later: real **Razorpay** SDK on device, ticket PDF/open in browser, push (EAS).
