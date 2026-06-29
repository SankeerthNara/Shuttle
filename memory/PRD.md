# Colony Badminton Court Booking — PRD

## Problem Statement
Build a booking website for a colony's badminton court (5 AM – 9 AM and 4 PM – 9 PM, hourly slots, max 8 persons/slot). Users must:
- Register with mobile + password and pay a ₹2,000 refundable security deposit (Razorpay)
- Login with mobile + password
- Book the same hourly slot for an entire month (only one slot per user per month)
- Pay monthly fee via Razorpay
Admin must be able to view users/bookings/payments, refund deposits, manage holidays, reset user passwords. Cloud database. Razorpay payments. GoDaddy domain deployment.

## User Personas
- **Resident (Member)**: Books one monthly slot.
- **Admin**: Manages users, payments, refunds, holidays.

## Architecture
- Backend: FastAPI + Motor (MongoDB) + Razorpay SDK + JWT auth + bcrypt.
- Frontend: React (CRA) + react-router-dom + sonner + lucide-react + Razorpay Checkout JS.
- DB: MongoDB collections — users, bookings, payments, holidays.

## Core Requirements (static)
- Hourly slots: 0500, 0600, 0700, 0800, 1600, 1700, 1800, 1900, 2000 (9 total).
- Max 8 active members per slot per month.
- Each user can have only one confirmed booking per month.
- Security deposit ₹2,000 collected on registration.
- Monthly slot fee configurable via env (default ₹500).
- Razorpay signature verified on backend.

## Implemented (2026-02)
- Auth: register/init (creates pending user + Razorpay order), register/verify (signature → activates user, JWT), login, me, admin auto-seed.
- Slots: `/api/slots/availability?month=YYYY-MM` returns 9 slots with bookings, capacity, "is_yours".
- Bookings: init + verify with Razorpay signature; capacity & one-per-month checks.
- Holidays: GET (members), POST/DELETE (admin).
- Admin: list users/bookings/payments, refund deposit (Razorpay refund API), reset password, holiday CRUD.
- Frontend: Landing (Performance Pro dark theme), Register (with embedded Razorpay), Login, Dashboard (slot board + my bookings), Admin Dashboard (tabs for users/bookings/payments/holidays + actions).

## Backlog (Prioritized)
- **P0**: Configure RAZORPAY_KEY_ID/SECRET in `.env` to enable real registration & booking flows. (User to provide keys.)
- **P1**: Email/SMS notifications on booking confirm (Twilio/SendGrid).
- **P1**: Auto-renew prompt for next month + waiting list when slot full.
- **P2**: User profile edit & change password (self-service).
- **P2**: Slot calendar view honoring holidays.
- **P2**: Razorpay webhook endpoint for async payment events.
- **P2**: Per-day attendance log (who actually showed up).

## Deployment Notes
- Domain on GoDaddy: After user approval, point GoDaddy DNS to Emergent deployment.
