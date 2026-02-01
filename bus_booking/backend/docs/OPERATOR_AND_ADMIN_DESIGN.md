# Operator & Admin: Who Sets What, and How It Works

This doc answers: **who decides bus layout, boarding/dropping points, timings**, and **whether operators get a separate login** with **admin verification**.

---

## 1. Who Decides What (recommended ownership)

| Thing | Who decides | Where it lives today |
|-------|-------------|----------------------|
| **Bus layout** (rows, cols, seat labels) | **Operator** (per bus) | `Bus.seat_map_json` – one layout per bus |
| **Boarding points** (where bus picks up, time) | **Operator** (per schedule) | `BoardingPoint` – linked to `Schedule` |
| **Dropping points** (where bus drops, time) | **Operator** (per schedule) | `DroppingPoint` – linked to `Schedule` |
| **Bus timing** (departure/arrival, fare) | **Operator** (per schedule) | `Schedule.departure_dt`, `arrival_dt`, `fare` |
| **Routes** (origin ↔ destination) | **Admin** (or system) | `Route` in `common` – shared by all operators |
| **Which operators can run buses** | **Admin** | `Operator` – admin creates/approves (e.g. KYC) |

So: **operators** own bus layout, boarding/dropping, and timings for **their** buses and schedules. **Admin** owns routes and operator approval. Different buses can have different layouts because each **Bus** has its own `seat_map_json`.

---

## 2. Do Operators Get a Separate Login?

**Yes.** You already have:

- **User** with `role`: `PASSENGER`, `OPERATOR`, `ADMIN`
- Demo user: `demo_operator` with role `OPERATOR`

What’s missing today:

- **Link from User to Operator**  
  So we know which operator company a logged-in operator user belongs to (e.g. `User.operator` FK to `Operator`, or `Operator.user` OneToOne).
- **Operator-only UI/APIs**  
  So an operator can:
  - Manage **their** buses (add bus, set `seat_map_json` for layout)
  - Create **schedules** for their buses on existing **routes**
  - Set **boarding points** and **dropping points** per schedule
  - Set **departure/arrival** and **fare**

So: **separate login** = same app, same JWT; operator user logs in and only sees/edits data for their `Operator`. You can either:

- Give operators a **separate frontend** (e.g. “Operator portal”) that calls operator APIs, or
- Let them use **Django Admin** with a custom admin that filters by their operator (after you link User → Operator).

---

## 3. Is Operator Content Verified/Accepted by Admin?

Two common patterns:

### Option A – Admin approves before going live (recommended for trust)

- Operator creates/edits: **Bus**, **Schedule**, **BoardingPoint**, **DroppingPoint**.
- These are saved with a status like **PENDING** (or “draft”).
- **Admin** reviews in Django Admin (or an admin API) and sets status to **APPROVED** (or “active”).
- Only **APPROVED** buses/schedules appear in **search and booking** (passenger app).

You’d add something like:

- `Bus`: e.g. `status = PENDING | APPROVED` (optional, if you want bus-level approval).
- `Schedule`: you already have `status = ACTIVE | CANCELLED`. You can add `PENDING` and only list `ACTIVE` in public search; admin flips `PENDING` → `ACTIVE` after verification.

Boarding/dropping are part of a schedule; once the schedule is APPROVED/ACTIVE, those points are “verified” with it.

### Option B – Operator goes live directly

- Operator creates buses and schedules; they become **ACTIVE** immediately.
- Admin only does **reactive** moderation (KYC, complaints). No “approve each schedule” step.

Today your codebase is effectively **Option B**: schedules are created as ACTIVE. You can introduce Option A by adding a `PENDING` state and filtering public APIs by `status = ACTIVE` and (if you add it) bus/schedule approval.

---

## 4. End-to-end flow (recommended)

1. **Admin**
   - Creates **Routes** (e.g. Bengaluru → Pondicherry).
   - Creates **Operators** (company name, contact, KYC, bank details).
   - Optionally: approves **Operator** (e.g. set `kyc_status = APPROVED`); only approved operators can add buses/schedules.
   - If you use approval: approves **Bus** and/or **Schedule** (PENDING → ACTIVE) so they show in passenger search.

2. **Operator** (separate login, linked to one Operator)
   - Adds **Buses** for their company:
     - Registration number, capacity.
     - **Layout**: sets `seat_map_json` (rows, cols, labels) per bus – so each bus can have a different layout.
   - Creates **Schedules** for their buses:
     - Picks an existing **Route**, sets **departure/arrival** and **fare**.
     - Adds **Boarding points** and **Dropping points** for that schedule (time, location name, landmark/description).
   - Optionally: submits for approval; admin sets schedule (or bus) to ACTIVE.

3. **Passenger**
   - Searches by route/date; sees only **ACTIVE** schedules (and approved buses, if you add that).
   - Selects bus, seats (layout comes from `Bus.seat_map_json`), boarding/dropping, pays – no change to who “decides” layout/points; they’re already set by the operator.

---

## 5. Implemented (summary)

- **User ↔ Operator link**  
  `User.operator` FK (null for non-operator). Migration: `users.0002_add_user_operator_link`. In Django Admin you can set a user’s **operator** when role is OPERATOR. Seed: `seed_demo` links `demo_operator` to the Demo Travels operator.

- **Schedule PENDING/ACTIVE**  
  `Schedule.status` choices: `PENDING`, `ACTIVE`, `CANCELLED`. Default for new schedules: `PENDING`. Migration: `bookings.0005_schedule_pending_status`. Public schedule list and seat-map/reserve/payment only use **ACTIVE** schedules. Admin can set a schedule to ACTIVE in Django Admin to “approve” it.

- **Operator-scoped APIs** (app: `operator_portal`)  
  - **Permission:** `IsOperator` (user must be authenticated, `role == OPERATOR`, and `user.operator_id` set).
  - **Buses:** `GET/POST /api/operator/buses/`, `GET/PUT/PATCH /api/operator/buses/<id>/`. Operator can list/create/update only their buses. Payload includes `seat_map` (JSON: `rows`, `cols`, `labels`).
  - **Schedules:** `GET/POST /api/operator/schedules/`, `GET/PUT/PATCH /api/operator/schedules/<id>/`. Operator can list/create/update only schedules for their buses. Create/update accept nested `boarding_points` and `dropping_points` (each: `time`, `location_name`, `landmark`/`description`). New schedules are created with `status=PENDING`; admin sets to ACTIVE in Django Admin.

- **Admin**  
  Django Admin: create Routes, create Operators, link User to Operator, set Schedule status to ACTIVE to approve.
