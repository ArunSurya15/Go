# How to run the server and frontend

## 1. Backend (Django API)

From the project root (`bus_booking`):

```bash
# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Go to backend
cd backend

# Run migrations (first time or after model changes)
python manage.py migrate

# Start the API server (default: http://127.0.0.1:8000)
python manage.py runserver
```

Leave this terminal open. The API will be at **http://127.0.0.1:8000**.

---

## 2. Frontend (Next.js)

Open a **second terminal**:

```bash
# From project root
cd bus_booking\frontend

# Install dependencies (first time only)
npm install

# Start the dev server (default: http://localhost:3000)
npm run dev
```

Leave this terminal open. The app will be at **http://localhost:3000**.

---

## 3. Optional: seed demo data

In a terminal (with venv active and `backend` as current directory):

```bash
cd backend
python manage.py seed_demo
```

This creates demo user(s), route, operator, bus, and schedules.

---

## Quick reference

| What        | Command              | URL                    |
|------------|----------------------|------------------------|
| Backend API| `python manage.py runserver` (from `backend`) | http://127.0.0.1:8000 |
| Frontend   | `npm run dev` (from `frontend`)              | http://localhost:3000 |
| API docs   | (backend running)   | http://127.0.0.1:8000/api/docs/ |

The frontend uses `NEXT_PUBLIC_API_URL` or defaults to `http://127.0.0.1:8000` for API calls. Start the backend first, then the frontend.
