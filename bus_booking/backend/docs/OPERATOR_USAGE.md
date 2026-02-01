# How to Use the App as an Operator

Operators manage **their** buses and schedules via the **Operator API**. There is no operator UI yet—you use the API (e.g. Postman, curl, or a future operator portal).

---

## 1. Get operator access

### Option A: Use the demo operator (after seeding)

1. Run the seed command (if you haven’t):
   ```bash
   cd backend
   python manage.py seed_demo
   ```
2. The user **demo_operator** (password: `Passw0rd!`) is linked to the operator **Demo Travels**.
3. Log in as **demo_operator** to get a JWT and call the operator APIs.

### Option B: Create an operator and link a user (Django Admin)

1. In Django Admin: **Buses → Operators** → Add Operator (name, contact, KYC status, etc.).
2. **Users → Users** → Add User (or pick existing). Set **Role** = **Operator**, **Operator** = the operator you created. Save.
3. Log in with that user’s username/password to get a JWT and call the operator APIs.

---

## 2. Log in and get a JWT

**POST** `/api/users/login/`  
Body (JSON):

```json
{
  "username": "demo_operator",
  "password": "Passw0rd!"
}
```

Response includes:

```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

Use the **access** token in the header for all operator API calls:

```
Authorization: Bearer <access>
```

---

## 3. Operator API base URL

All operator endpoints are under:

```
/api/operator/
```

You must be logged in (JWT) and your user must have **role = OPERATOR** and an **operator** linked. Otherwise you get **403 Operator access required.**

---

## 4. What you can do as an operator

### Buses

| Action   | Method | URL                        | Body (example) |
|----------|--------|----------------------------|----------------|
| List     | GET    | `/api/operator/buses/`     | —              |
| Create   | POST   | `/api/operator/buses/`     | See below     |
| Get one  | GET    | `/api/operator/buses/<id>/`| —              |
| Update   | PATCH  | `/api/operator/buses/<id>/`| See below     |

**Create/update bus** (JSON):

```json
{
  "registration_no": "KA01AB9999",
  "capacity": 40,
  "seat_map": {
    "rows": 10,
    "cols": 4,
    "labels": ["1A","1B","1C","1D", "2A","2B","2C","2D", ...]
  }
}
```

`operator` is set automatically to your operator. You define the **bus layout** with `seat_map` (rows, cols, labels).

---

### Schedules (with boarding & dropping points)

| Action   | Method | URL                              | Body (example) |
|----------|--------|-----------------------------------|----------------|
| List     | GET    | `/api/operator/schedules/`        | —              |
| Create   | POST   | `/api/operator/schedules/`        | See below     |
| Get one  | GET    | `/api/operator/schedules/<id>/`   | —              |
| Update   | PATCH  | `/api/operator/schedules/<id>/`    | See below     |

**Create schedule** (JSON). Use existing **route_id** and **bus_id** (your bus):

```json
{
  "bus": 1,
  "route": 1,
  "departure_dt": "2025-02-15T07:00:00",
  "arrival_dt": "2025-02-15T15:00:00",
  "fare": "899.00",
  "boarding_points": [
    { "time": "06:45", "location_name": "Yelahanka", "landmark": "Near Mahindra Showroom" },
    { "time": "07:00", "location_name": "Hebbal", "landmark": "Esteem Mall" }
  ],
  "dropping_points": [
    { "time": "14:50", "location_name": "Morattandi Toll", "description": "Toll plaza" },
    { "time": "15:00", "location_name": "Pondicherry Bus Stand", "description": "Main exit" }
  ]
}
```

- New schedules are created with **status = PENDING**. They do **not** appear in passenger search until an admin sets status to **ACTIVE** in Django Admin.
- **Routes** are created by admin. List them with **GET** `/api/routes/` (no auth) to get `id`, `origin`, `destination`.

---

## 5. Quick test with curl

Replace `YOUR_ACCESS_TOKEN` and base URL as needed.

```bash
# 1. Login
curl -X POST http://localhost:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_operator","password":"Passw0rd!"}'

# 2. List your buses (use the "access" value from step 1)
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8000/api/operator/buses/

# 3. List your schedules
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8000/api/operator/schedules/
```

---

## 6. Summary

| Step | What to do |
|------|------------|
| 1    | Be an operator user (demo_operator after seed, or user linked to an operator in Admin). |
| 2    | **POST** `/api/users/login/` → get `access` token. |
| 3    | Call **GET/POST/PATCH** `/api/operator/buses/` and `/api/operator/schedules/` with **Authorization: Bearer &lt;access&gt;**. |
| 4    | New schedules are **PENDING**. Admin sets them to **ACTIVE** in Django Admin so passengers can see and book them. |

There is no operator web UI yet; use the API (or Django Admin for simple edits) until an operator portal is built.
