# OpenKPI Studio

**AI-powered KPI intelligence for enterprise analytics teams.**

> Turn KPI confusion into trusted business intelligence. Document metrics, explain dashboard logic, trace source-system lineage and generate executive-ready insights with an AI-powered KPI workspace.

OpenKPI Studio is an open-source **KPI governance + AI explanation layer** that sits between your source systems and your dashboards. It is not a BI tool — it is the *understanding layer* on top of one.

**Live demo:** <https://openstudio.oneplaceplatform.com>

---

## Why enterprises need this

Every month, business leaders ask the same questions of analytics teams:

- *"What does this KPI actually mean?"*
- *"Why did this number move?"*
- *"Can we trust this in the board pack?"*
- *"Which source system is this coming from?"*

Today the answers live in slide decks, wiki pages, Slack threads, and senior analysts' heads. OpenKPI gives them a home: every KPI gets a governance page, a lineage map, and an AI agent that answers questions about it — grounded in the certified definitions, not free-text hallucination.

---

## What's live today

A complete multi-tenant SaaS surface. Anyone can:

1. **Visit the public demo** — `/w/demo` is read-only for anonymous visitors.
2. **Create a private workspace** — `/w/new` (sign-in required). The creator is auto-promoted to ADMIN.
3. **Populate it three ways** via the onboarding wizard:
   - **CSV upload** — `/w/<slug>/import`. Drag/drop, auto-maps fuzzy headers ("Metric" → name, "Source" → source_system, etc.).
   - **SQL connector** — `/w/<slug>/connections/new`. Paste a Postgres URL, write SQL that returns one number, save as a live KPI.
   - **Clone sample data** — one-click button on the wizard; copies the demo's 10 KPIs + 3 lineage flows.
4. **Edit anything inline** — definition, formula, limitations, owner, source system, "why moved" — click-to-edit on the KPI detail page.
5. **Flip status** — click the badge on any KPI card → Certified / Draft / Needs Review.
6. **Ask the AI** — `/w/<slug>/explainer`. Real Claude (Sonnet 4.6) grounded in the KPI's certified metadata. Cites sources, surfaces assumptions, returns a confidence score.
7. **Auto-document missing fields** — workspace banner: "N KPIs are missing documentation". One click, Claude drafts definitions/formulas/limitations for all of them.
8. **Connect a database** — encrypted-at-rest credentials (AES-256-GCM), read-only transaction wrapper, 10-second statement timeout.
9. **Schedule auto-refresh** — pick a cadence per KPI (Real-time / Hourly / Daily / Weekly / Monthly / Quarterly / Manual). A host cron tick re-runs the query, updates value/trend, appends a history point.
10. **Invite teammates** — admin generates a 14-day invite link; recipient clicks → signs in → membership upserted.
11. **Audit everything** — `/w/<slug>/audit`. Tone-coded feed of every action, filterable by type, cursor-paginated.
12. **Customise visibility** — workspace settings page. Flip between PUBLIC (readable by anon, edits still gated) and PRIVATE (members only). Rename, change currency, delete.

---

## Architecture (what's actually built)

```
┌────────────────────┐   ┌─────────────────────────────────────────┐
│   Source Systems   │   │      OpenKPI Studio (Next.js 14)        │
│                    │   │                                          │
│   Postgres /       │──▶│   ┌──────────────────────────────────┐  │
│   Redshift /       │   │   │  Connector framework             │  │
│   Aurora           │   │   │  (server-only)                   │  │
│   CSV / Excel      │   │   │  - PostgresConnector (live)      │  │
│                    │   │   │  - Snowflake / MSSQL / BigQuery  │  │
└────────────────────┘   │   │    stubs (Phase B)               │  │
                         │   └──────────────────────────────────┘  │
┌────────────────────┐   │   ┌──────────────────────────────────┐  │
│   Anthropic Claude │◀──┤   │  AI layer                        │  │
│   (claude-sonnet-  │   │   │  - /api/explain (RAG-grounded)   │  │
│    4-6)            │──▶│   │  - /api/suggest (autodoc)        │  │
└────────────────────┘   │   └──────────────────────────────────┘  │
                         │   ┌──────────────────────────────────┐  │
                         │   │  Multi-tenancy + ACL             │  │
                         │   │  - NextAuth (Google + email +    │  │
                         │   │    dev-credentials for testing)  │  │
                         │   │  - Workspace.visibility          │  │
                         │   │  - Membership role: ADMIN /      │  │
                         │   │    STEWARD / EDITOR / VIEWER     │  │
                         │   │  - Invitation tokens             │  │
                         │   └──────────────────────────────────┘  │
                         │   ┌──────────────────────────────────┐  │
                         │   │  Schedule                        │  │
                         │   │  - Host cron */5 * * * *         │  │
                         │   │  - /api/cron/refresh-due         │  │
                         │   │    (Bearer-protected)            │  │
                         │   └──────────────────────────────────┘  │
                         │   ┌──────────────────────────────────┐  │
                         │   │  Audit log                       │  │
                         │   │  Every write logged with         │  │
                         │   │  pretty-formatted detail         │  │
                         │   └──────────────────────────────────┘  │
                         └──────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌──────────────────────────────────────────┐
                         │   Postgres 17 (Coolify pgvector)         │
                         │   - 14 tables, Prisma schema             │
                         │   - AES-256-GCM credentials at rest      │
                         └──────────────────────────────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for the full picture.

---

## Tech stack

- **Next.js 14** (App Router, server components, route handlers, standalone build)
- **TypeScript** (strict)
- **Prisma 5** + **Postgres 17** (multi-tenant schema, 14 models)
- **NextAuth v4** (Google OAuth + email magic link + dev-credentials for offline testing)
- **Anthropic SDK** (Claude Sonnet 4.6, JSON-structured responses)
- **Custom CSS Modules + CSS-variable theme system** — no Tailwind, no CSS-in-JS runtime
- **CSS-variable theming** — 5 themes (Light / Dark / Midnight / Slate / Solarized) × 6 accents × 2 densities. Adding a theme is one block of CSS.
- **lucide-react** for icons
- **papaparse** for CSV parsing
- **pg** for the Postgres connector
- **Custom SVG charts** (Sparkline + TrendChart with period selector)
- **Docker** multi-stage build with Next.js standalone output (~150MB image)

---

## Getting started locally

Requires Node.js 20+ and a Postgres database.

```bash
# 1. Install
npm install --legacy-peer-deps

# 2. Configure
cp .env.example .env.local
# Fill in DATABASE_URL, ANTHROPIC_API_KEY, ENCRYPTION_KEY, CRON_SECRET.
# Generate the secret keys with:
#   openssl rand -base64 32       # NEXTAUTH_SECRET, ENCRYPTION_KEY
#   openssl rand -hex 32           # CRON_SECRET
# Set OPENKPI_DEV_AUTH=true to enable any-email sign-in locally.

# 3. Apply schema + seed demo workspace
npx prisma db push
npx tsx prisma/seed.ts

# 4. Run
npm run dev
```

Open <http://localhost:3000>. The seeded `demo` workspace lives at `/w/demo`.

### Scripts

| Command         | What it does                          |
| --------------- | ------------------------------------- |
| `npm run dev`   | Local dev server                      |
| `npm run build` | Production build (uses standalone output) |
| `npm run start` | Run the production build              |
| `npm run lint`  | Lint with `next/core-web-vitals`      |
| `bash scripts/smoke.sh`      | Anonymous-flow smoke tests (49 cases) |
| `bash scripts/auth-smoke.sh` | Authenticated end-to-end tests (27 cases) — requires `OPENKPI_DEV_AUTH=true` |

---

## Deployment

A live deployment runs on Hetzner Cloud behind a Coolify-managed Traefik proxy at <https://openstudio.oneplaceplatform.com>.

The deploy flow is:

```bash
# Local
OPENKPI_SSH_HOST=root@<server-ip> ./deploy/hetzner/deploy.sh
```

That single command:

1. `rsync` / `tar` streams the project to `/opt/openkpi-studio`, excluding `node_modules`, `.next`, `.git`, and every `.env*` file
2. `scp`s your local `.env.local` to the server as `.env` (the only place real secrets land)
3. `docker compose up -d --build` rebuilds the multi-stage image and recreates the container
4. Traefik labels in `docker-compose.yml` auto-wire the public hostname + LetsEncrypt cert

A host cron entry (`*/5 * * * *`) hits `/api/cron/refresh-due` with the Bearer token to auto-update connector-backed KPIs.

See [docs/deploy.md](docs/deploy.md) for the secret-handling model, network notes (the `docker0` collision with Hetzner private networks, fixed by a persistent `/32` route), and how to rotate keys without redeploying.

### Secret hygiene

- `.gitignore` blocks every `.env*` variant **except** `.env.example`. Verified with `git check-ignore`.
- The deploy script defensively excludes `.env*` from rsync.
- Connector credentials are encrypted at rest with AES-256-GCM (12-byte IV, 16-byte auth tag) using `$ENCRYPTION_KEY`.
- The Anthropic key, DB URL, Cron secret, and Encryption key all live only in `.env.local` (your laptop) and `/opt/openkpi-studio/.env` (the server). Never in git.

---

## Testing

Two smoke-test suites verify the production surface end-to-end:

```bash
BASE=https://openstudio.oneplaceplatform.com bash scripts/smoke.sh
# → 49 cases: public reads, private-workspace gates, anon-mutation
#   refusals (401), AI explainer round-trip, CSV sample download, UI
#   structural markers (KpiStatusMenu, InlineEdit, TrendChart period bar).

BASE=https://openstudio.oneplaceplatform.com bash scripts/auth-smoke.sh
# → 27 cases: dev sign-in, workspace create, /w/<slug> direct land
#   (no /login bounce for the creator), seed-sample clone, inline-edit,
#   autodocument, cadence flip, member invite, audit page surfacing the
#   events, visibility PUBLIC↔PRIVATE toggle, delete.
```

Latest run: **49/49 + 27/27 PASS**.

---

## Project structure

```
src/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # / → redirect /w/demo
│   ├── login/                        # NextAuth sign-in UI
│   ├── invite/[token]/               # accept-invite flow
│   └── w/[slug]/                     # workspace-scoped pages
│       ├── layout.tsx                # ACL gate (redirects PRIVATE → /login)
│       ├── page.tsx                  # Command Center
│       ├── catalog/                  # KPI catalog + detail
│       ├── connections/              # SQL connector flow
│       ├── audit/                    # audit log viewer
│       ├── members/                  # invite + member list
│       ├── settings/                 # rename, visibility, danger zone
│       ├── import/                   # CSV upload
│       ├── explainer/                # AI chat
│       ├── lineage/                  # lineage map
│       ├── brief/                    # executive brief
│       └── dax-sql/                  # DAX/SQL plain-English explainer
├── components/
│   ├── layout/ (Shell, Sidebar, TopBar, Hero, AuthWidget)
│   ├── kpi/ (KPICard, KpiStatusMenu, SummaryCard)
│   ├── charts/ (Sparkline, TrendChart with period selector)
│   ├── ui/ (InlineEdit, ConfidenceDial, StatusBadge)
│   ├── views/ (CommandCenterView, CatalogView, KpiDetailView,
│              ExplainerView, LineageView, Onboarding)
│   └── providers/ (ThemeProvider, SessionWrapper)
├── lib/
│   ├── acl.ts          # getViewer, getWorkspaceAccess, gateView/gateEdit
│   ├── auth.ts         # NextAuth options (Google + Email + dev creds)
│   ├── crypto.ts       # AES-256-GCM encrypt/decrypt
│   ├── db.ts           # Prisma client singleton
│   ├── queries.ts      # server-only DB queries
│   ├── adapters.ts     # DB row → UI shape
│   ├── auditFormat.ts  # pretty-formatter for audit events
│   ├── schedule.ts     # cadence map, isDue, relativeTime
│   ├── connectors/     # framework + Postgres impl
│   ├── import/         # CSV parse/validate/write
│   └── ai/             # Anthropic call wrappers (explain, suggest)
├── types/              # shared TypeScript types
├── prisma/             # schema + seed
└── scripts/            # smoke.sh, auth-smoke.sh
```

---

## Roadmap

| Phase | Status |
| --- | --- |
| **1. Multi-workspace UI + Anthropic Claude grounded in metadata** | ✅ |
| **2. NextAuth + ACL + member invites** | ✅ |
| **3. CSV / Excel upload + smart header aliasing** | ✅ |
| **4. SQL connector framework + Postgres driver** | ✅ |
| **5. Scheduled refresh (host cron + Bearer-auth endpoint)** | ✅ |
| **6. AI-assisted documentation (per-KPI + bulk autodoc)** | ✅ |
| **7. Workspace settings + inline KPI editing + status menu** | ✅ |
| **8. Audit log viewer** | ✅ |
| **9. Onboarding wizard + trend chart period selector** | ✅ |
| **10. Snowflake / MSSQL / BigQuery / Power BI connectors** | next |
| **11. Real auth providers (Google + Resend SMTP)** | next (currently dev-credentials enabled for testing) |
| **12. Slack / email alerts on refresh failure** | future |
| **13. Embeddable KPI tiles** | future |
| **14. SSO (OIDC) + audit-event export + SOC2 controls mapping** | future |

See [docs/roadmap.md](docs/roadmap.md) for the longer-form plan.

---

## Contributing

Suggested first issues:

- Add a new theme to `globals.css` (one block of CSS variables — see Light/Dark/Midnight/Slate/Solarized for templates)
- Add a new connector kind to `src/lib/connectors/` (implement the `Connector` interface; register in `kinds.ts` + `index.ts`)
- Improve the CSV importer's column-alias map in `src/lib/import/schema.ts`
- Wire up Resend SMTP for the magic-link email provider
- Add the **multi-period trend chart** zoom interaction (today the period selector slices the array; a brushable zoom would be nicer)

File an issue first for anything bigger than a small UI tweak.

---

## License

MIT — see [LICENSE](LICENSE).
