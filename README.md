# Inside Bars

A curated guide to events in Berlin's small, independent bars — live music, quiz nights, open mics, drag, comedy, and more.

Live at [insidebars.co](https://insidebars.co).

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Edge Functions)
- React Router, TanStack Query, React Hook Form + Zod
- Hosted on Vercel

## Development

```sh
npm install
npm run dev          # http://localhost:8080
npm run build        # production build
npm run lint         # eslint
npm test             # vitest
```

Type-check the app entry config:

```sh
npx tsc -p tsconfig.app.json --noEmit
```
