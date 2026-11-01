# A-Bid

Reverse marketplace for short-term rentals: travelers post trip requests (budget + expectations), property owners privately bid discounted rates for empty nights — without touching their public listing price.

**Stack:** React + Vite + Tailwind/shadcn (client/), Express + Drizzle + SQLite (server/), shared Zod-validated schema (shared/).

## Run it

```bash
npm install
npm run dev        # http://localhost:5000 (serves API + client)
```

Production build:

```bash
npm run build
npm start
```

Type check: `npm run check`

## Demo accounts

All seeded accounts use the password **`abid-demo-2026`**:

| Email | Role |
|---|---|
| `sarah@example.com` | guest (traveler) |
| `mike@example.com` | guest (traveler) |
| `jen@example.com` | owner |
| `david@example.com` | owner |
| `maria@example.com` | owner |
| `admin@example.com` | admin |

Or create your own account from the sign-in page (traveler or owner).

## Money model

- **Payment plan (fixed Oct 2026):** accepting a bid creates three payments — a refundable damage-deposit hold (20% of the agreed total, collected on top) plus the stay split into an installment (40%) and a final payment (remainder). The stay payments always sum to **exactly 100%** of the agreed total (integer-cent math with a server-side assertion).
- **Owner accounting is cash-basis:** income hits the ledger exactly once per payment, when the payment is marked paid. No revenue is booked at bid-accept time.
- **Settlement:** on-platform via Stripe Connect (destination charges). See [STRIPE_SETUP.md](STRIPE_SETUP.md). Without Stripe keys, payments use the manual demo path.

## Auth

Session-based auth (express-session + bcrypt password hashing). Guests can only touch their own trips/bookings/payments; owners only their own properties/bids/ledger; admin routes are restricted. The old header-based demo user switcher is gone.
