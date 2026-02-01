# BusGo Frontend

Next.js + Tailwind CSS + shadcn/ui + Framer Motion frontend for the bus booking API.

## Setup

1. **Install dependencies**

   ```bash
   cd frontend
   npm install
   ```

2. **Environment**

   Copy `.env.local.example` to `.env.local` and set your backend URL:

   ```
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   ```

3. **Run backend**

   From the project root, start the Django server:

   ```bash
   cd backend
   python manage.py runserver
   ```

4. **Run frontend**

   ```bash
   cd frontend
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Flow

- **Search** – Home: enter From, To, Date → search routes → list schedules.
- **Book** – Select a schedule → enter seats (e.g. `1A, 1B`) → Reserve & create payment.
- **Demo payment** – Click “Simulate payment success” to trigger the webhook and confirm the booking.
- **Ticket** – On the booking success page, click “Download ticket (PDF)”.

## Tech

- **Next.js 14** (App Router)
- **Tailwind CSS** + **shadcn/ui** (Button, Card, Input, Label)
- **Framer Motion** (layout and page transitions)
- **JWT** stored in `localStorage`; auth context for login/register/logout
