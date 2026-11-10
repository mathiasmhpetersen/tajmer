# Tajmer · Live Ads

Internal dashboard showing, per artist, which Meta ads are **active and have spent
money** in the Tajmer Booking ad account — with the ad creatives rendered inline
(the real Facebook-feed preview, no click-through), in the style of Adtool.io's
review view.

- **Frontend:** Vite + React 18 + TypeScript + Tailwind, `wouter` routing,
  TanStack Query. Built to `dist/public`.
- **Backend:** Vercel Serverless Functions in `/api/*`. The Meta token is read
  **only** on the server — never shipped to the client bundle.
- **No database.** Artists live in config (`shared/artists.ts`); a simple password
  gate protects the API.

Live target: **https://tajmer.vercel.app**

## Project layout

```
api/                     Vercel serverless functions (Node runtime)
  _lib/
    auth.ts              HMAC cookie login gate
    http.ts              cache headers, error shaping
    meta.ts              Meta Graph client + data builders
    cities.ts            DK city list for the "Tjek copy" heuristic
  login.ts               POST /api/login
  overview.ts            GET  /api/overview?range=
  artist/[slug].ts       GET  /api/artist/:slug?range=
shared/                  Shared with the client (artists config + API types)
client/                  React app (root for Vite)
  src/{components,pages,lib,config}
dist/public/             Build output (gitignored)
```

## Meta System User token

1. **Business Settings → System Users** → create (or pick) a System User.
2. **Generate new token** → app = your Meta app → scope **`ads_read`**.
3. **Assign assets** → add the ad account **Primær annoncekonto - Tajmer Booking**
   (`act_1222051031227513`) with at least _View performance_.
4. Use a **long-lived / never-expiring System User token**. Paste it into
   `META_ACCESS_TOKEN`.

## Environment variables

Copy `.env.example` → `.env` for local dev, and set the same three in Vercel
(Production + Preview):

| Var                   | Notes                                               |
| --------------------- | --------------------------------------------------- |
| `META_ACCESS_TOKEN`   | System User token with `ads_read`                   |
| `META_AD_ACCOUNT_ID`  | `1222051031227513` (without the `act_` prefix)      |
| `META_API_VERSION`    | optional, defaults to `v21.0`                       |
| `SITE_PASSWORD`       | admin password — full dashboard                     |
| `CLIENT_PASSWORD`     | client password — creatives only, spend hidden (optional) |

## Local development

```bash
pnpm install
pnpm vercel dev        # serves the React app AND the /api functions on :3000
```

> Plain `pnpm dev` runs only Vite (port 5173) and proxies `/api` → `localhost:3000`.
> For the functions to answer, run `vercel dev` (or point the proxy at it). Using
> `vercel dev` for both is the simplest path.

Other scripts:

```bash
pnpm build        # vite build → dist/public
pnpm typecheck    # tsc for client + api
```

## Two versions (admin / client)

One codebase serves two versions, chosen by which password you log in with:

- **Admin** (`SITE_PASSWORD`) — the full dashboard: spend, impressions, clicks,
  results, KPI rows, range toggle, Ads Manager links and internal flags.
- **Client** (`CLIENT_PASSWORD`) — a clean creative-review view: artist list and
  ad previews only. All spend/performance data is **stripped on the server**
  (`stripOverviewForClient` / `stripArtistForClient` in `api/_lib/meta.ts`), so
  it never reaches the client's browser — not even in the network tab. The UI
  additionally hides KPI cards, the range toggle, per-ad metrics, the Ads Manager
  button and QA flags, and renames "Kunstnere" → "Artister".

The role is carried in the signed `tajmer_auth` cookie; `/api/session` reports it
to the app on load. The admin cookie signature is unchanged from the single-role
build, so existing admin logins keep working.

## Preview / approval (`/preview`)

A section (sidebar → Værktøj → Preview) showing ads that are **set up but not yet
delivering** — ad-level `PAUSED / IN_PROCESS / PENDING_REVIEW / WITH_ISSUES`, or
`ACTIVE` with a future ad-set start — so the client (Tenna) can approve them
before they go live. To keep it to genuinely new ads (an account accumulates
hundreds of old paused ads), candidates are scoped to those **created in the last
`PREVIEW_MAX_AGE_DAYS` days** (default 45) that have **never delivered** (0
lifetime impressions). Ads whose name starts with `SLET |` are excluded; ads are
grouped by artist → campaign. Previews are fetched live per request and never
persisted.

- **Approve** per ad (toggle), per artist ("Godkend alle (N)") or all at once
  ("Godkend alle artister"); bulk actions confirm first. Status: _Afventer
  godkendelse_ / _Godkendt_ / _Rettelser ønsket_. Advisory only — nothing is
  changed in Meta. Approval is keyed by **creative id**, so replacing an ad's
  creative resets its approval automatically.
- **Corrections:** a thread per ad; sending one sets _Rettelser ønsket_ and clears
  approval. Marketingly marks a correction _Løst_ (optionally with a note shown to
  the client and a replacement ad id), after which approval must be given again.
- **Storage:** Vercel KV / Upstash Redis (`preview:approval:{adId}:{creativeId}`,
  `preview:feedback:{adId}`). No tokens or passwords are stored. If KV isn't
  configured, the section still lists ads (all "Afventer") and writes return 503.

Endpoints: `GET /api/preview`, `POST /api/preview/approve`,
`POST /api/preview/feedback`, `POST /api/preview/feedback/resolve`
(admin cookie **or** `Authorization: Bearer $PREVIEW_AGENT_TOKEN`), and
`GET /api/preview/feedback/open` (same dual auth) — a read-only JSON feed of
unresolved corrections + approval states for Marketingly's agent.

## Deploy (Vercel)

The repo is connected to the `tajmer` Vercel project and auto-deploys on push to
`main`. Project settings (already encoded in `vercel.json`):

- **Build Command:** `vite build`
- **Output Directory:** `dist/public`
- **Rewrites:** SPA fallback to `/index.html`, excluding `/api/*`.

Set the env vars for Production + Preview, push to `main`, then confirm
`https://tajmer.vercel.app/nikolaj-stokholm` renders live previews.

## Adding an artist

Append one row to `shared/artists.ts` — the sidebar, overview, routing and the
campaign→artist matching all read from it:

```ts
{ slug: "ny-kunstner", name: "Ny Kunstner", match: ["Ny Kunstner"] }
```

A campaign belongs to an artist if its name contains any `match` string
(case-insensitive), e.g. `Marketingly: Ny Kunstner (Salg)`.

## How it works

- `/api/overview` fetches all **active** campaigns once, assigns each to an artist
  by name match, pulls ad-level insights (`spend > 0`, ad `ACTIVE`) for the chosen
  range, and returns per-artist spend / active-ad counts / top-3 thumbnails.
- `/api/artist/:slug` does the same for one artist, then enriches each ad with its
  creative, a large thumbnail, and the real **MOBILE_FEED_STANDARD** preview
  iframe (concurrency-capped at 8). Ads are grouped by campaign.
- Responses set `s-maxage=300, stale-while-revalidate=60` so Vercel's edge caches
  them for 5 minutes. The **"Opdater nu"** button refetches with `?nocache=1`,
  which the functions honour with `Cache-Control: no-store`.
- Flags: a **Dublet** badge for repeated creatives within a campaign, and a
  **Tjek copy** badge when the ad name references a city the copy doesn't.
