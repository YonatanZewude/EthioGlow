# EthioGlow Premium Content Platform

Premium content-plattform med medlemskap.

## Funktioner

- Roller: `admin` och `paying_user`
- Clerk Auth inloggning (inkl Google)
- Stripe subscription for access
- Admin upload av bild/video med:
  - title
  - description
  - category
  - type
  - is_premium
- Favoriter per anvandare
- Senast uppladdat-lista
- Besoksanalys for admin: stad, land, tid och trafikkalla
- Kategori/filter: `Nytt`, `Populart`, `Premium`, `Video`, `Bild`
- Tydliga policyregler for copyright, alder, integritet och forbjudet innehall

## Stack

- Frontend: React + Vite + TypeScript
- Auth: Clerk
- DB/Storage: Supabase
- Betalning: Stripe
- Webhook + checkout endpoint: Express server (`server/index.js`)

## 1. Miljovariabler

Kopiera `.env.example` till `.env` och fyll i riktiga nycklar.

Frontend (Vite):

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_BACKEND_URL`

Backend:

- `CLERK_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `APP_URL`

## 2. Supabase setup

Kora SQL i [supabase/schema.sql](supabase/schema.sql).

Detta skapar:

- `profiles`
- `categories`
- `content_items`
- `favorites`
- `stripe_customers`
- `visitor_events`
- RLS policies
- Storage bucket: `premium-content` (private)

Viktigt for Clerk + Supabase:

1. I Clerk, skapa en JWT template med namnet `supabase`.
2. I Supabase, konfigurera Third-Party Auth (Clerk) enligt Supabase guide.
3. Appen skickar Clerk token till Supabase och RLS lases via JWT claim `sub`.

Viktigt efter setup:

1. Satt en anvandare till admin i `profiles` tabellen manuellt forsta gangen.
2. Skapa Stripe product + recurring price och satt `STRIPE_PRICE_ID`.

## 3. Stripe webhook

Lokalt exempel med Stripe CLI:

```bash
stripe listen --forward-to http://localhost:8787/api/stripe/webhook
```

Anvand webhook secret som skrivs ut av Stripe CLI i `STRIPE_WEBHOOK_SECRET`.

## 4. Starta appen

```bash
npm install
npm run dev:full
```

Det startar:

- Frontend pa `http://localhost:5173`
- Stripe backend pa `http://localhost:8787`

## 5. Deploy med Vercel + Render

### Frontend pa Vercel

1. Importera repot i Vercel.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Satt frontend env vars i Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_STRIPE_BACKEND_URL` = din Render URL, t.ex. `https://ethioglow-backend.onrender.com`

`vercel.json` finns i projektet for SPA-rewrite.

### Backend pa Render

1. Skapa Web Service i Render och koppla samma repo.
2. Render kan lasa [render.yaml](render.yaml) automatiskt.
3. Satt backend env vars i Render:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID`
  - `APP_URL` = din Vercel domain, t.ex. `https://your-app.vercel.app`
  - `CORS_ORIGINS` = kommaseparerade tillatna origins, t.ex. `https://your-app.vercel.app,http://localhost:5173`

Healthcheck endpoint finns pa `/healthz`.

### Stripe i produktion

1. Skapa webhook i Stripe Dashboard mot:
  - `https://DIN_RENDER_URL/api/stripe/webhook`
2. Lyssna pa events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
3. Kopiera webhook secret till `STRIPE_WEBHOOK_SECRET` i Render.

## Access-flode

1. Anvandare registrerar/loggar in via Clerk (inkl Google).
2. Om subscription ar inaktiv visas betalvagg.
3. Anvandaren klickar pa `Betala subscription`.
4. Stripe checkout skapas via backend.
5. Stripe webhook uppdaterar `profiles.subscription_status` och `subscription_active`.
6. Nar subscription ar aktiv far anvandaren se allt innehall.

## Policy och moderation

Plattformen inkluderar tydliga regler i UI:

- Copyright-regler
- 18+ alderspolicy
- Integritet och personuppgifter
- Forbjudet innehall

Du bor ocksa komplettera med:

- Terms of Service
- Privacy Policy
- DMCA/copyright complaint process
