# Home Organizer

A mobile-first PWA for managing your household pantry, shopping list, recipes, and supply closet — with multi-user household sync.

## Features

- **Pantry** — Track food stock with categories, filters, and low-stock alerts
- **Shopping List** — Seamlessly connected to Pantry & Supply; purchase flow auto-updates inventory
- **Recipes** — Ingredients, instructions, servings, and manual macros per serving
- **Supply Closet** — Non-food household items with the same inventory UX
- **Households** — Shared accounts with invite codes and realtime sync

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn-style components
- Supabase (PostgreSQL, Auth, Realtime)
- Deployed on Vercel (frontend) + Supabase Cloud (backend)

## Prerequisites

- **Node.js 18+** (Node 20 recommended — see `.nvmrc`)
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (for deployment)

On Windows with nvm:

```bash
nvm use 20.18.0
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the migration file:
   [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
3. Under **Project Settings → API**, copy your project URL and `anon` public key
4. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. In Supabase **Authentication → Providers**, ensure Email is enabled
6. For development, disable email confirmation under **Authentication → Providers → Email** (optional)

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). On iPhone, use Safari and tap **Share → Add to Home Screen** for an app-like experience.

### 4. Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

## Project structure

```
src/
├── components/     # Shared UI and layout
├── features/       # Pantry, Shopping, Recipes, Supply, Auth
├── hooks/          # Data hooks with Supabase + realtime
├── lib/            # Supabase client, constants, utilities
└── types/          # TypeScript database types
supabase/
└── migrations/     # SQL schema and RLS policies
```

## Household invite flow

1. First user creates a household and receives a 6-character invite code
2. Tap the **Users** icon in the header to copy the invite code
3. Other members sign up, then choose **Join with invite code**

## PWA icons

Replace `public/pwa-192.png` and `public/pwa-512.png` with your own icons before App Store submission. `public/favicon.svg` is used as the browser tab icon.

## App Store path (future)

When ready for the App Store:

1. **Capacitor** — Wrap this PWA in a native shell (fastest)
2. **Expo** — Rebuild UI in React Native, reuse Supabase backend

The database schema and API layer stay the same either way.
