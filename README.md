# Your Web App Builder

this is my final PRD for my web app i want you to make a  plan to build this without missing any sigle thing both customer and admin  please make a plan for it

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bond-building-suite.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/529eccc3-4215-42fe-b118-cd942d1f058f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Vercel

This app is a TanStack Start app with a Nitro server. `vite.config.ts` builds it
for Vercel (Nitro `vercel` preset → `.vercel/output`, the Vercel Build Output
API). `vercel.json` configures the project. Lovable's own build still targets
Cloudflare, so pushing to Lovable keeps working unchanged.

**1. Add environment variables in the Vercel dashboard**
(Project → Settings → Environment Variables — set these for Production and
Preview; the values are in your local `.env`, which is git-ignored):

| Variable | Notes |
| --- | --- |
| `VITE_SUPABASE_URL` | build-time, client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build-time, client |
| `VITE_SUPABASE_PROJECT_ID` | build-time, client |
| `SUPABASE_URL` | runtime, server |
| `SUPABASE_PUBLISHABLE_KEY` | runtime, server |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime, server (secret) |

**2. Connect the repo** — Vercel will detect `vercel.json`, run
`npm install` + `npm run build`, and use the generated `.vercel/output`.

**3. Deploy** — push to your connected branch, or run locally:
```sh
npm run build
npx vercel deploy --prebuilt
```

**4. Supabase auth callback** — add your Vercel domain to the Supabase project's
auth settings (Site URL / allowed redirect URLs).
