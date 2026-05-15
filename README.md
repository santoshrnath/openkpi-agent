# OpenKPI Studio

**AI-powered KPI intelligence for enterprise analytics teams.**

> Turn KPI confusion into trusted business intelligence. Document metrics, explain dashboard logic, trace source-system lineage and generate executive-ready insights with an AI-powered KPI workspace.

OpenKPI Studio is an open-source **KPI governance + AI explanation layer** that sits between your source systems and your dashboards. It is not a BI tool — it is the *understanding layer* on top of one.

---

## Why enterprises need this

In every large company, business leaders ask the same questions of analytics teams every month:

- *"What does this KPI actually mean?"*
- *"Why did this number move?"*
- *"Can we trust this in the board pack?"*
- *"Which source system is this coming from?"*

Today these answers live in slide decks, wiki pages, Slack threads and senior analysts' heads. OpenKPI gives them a home: every KPI gets a governance page, a lineage map, and an AI agent that can answer questions about it — grounded in the certified definitions, not free-text hallucination.

---

## Features

- **KPI Command Center** — a single pane for every KPI: certified, draft, needs-review. Each card shows value, trend, source, owner, confidence.
- **KPI Catalog & detail** — every KPI has a governance page: definition, formula, source, owner, refresh cadence, related dashboards, limitations and trend chart.
- **AI Explainer** — chat-style agent that answers plain-English questions about any KPI, with sources, assumptions and confidence.
- **Lineage Map** — visual end-to-end flow: source → staging → transformation → semantic → dashboard → KPI, with a details table.
- **Executive Brief** — board-ready summary of key movements, risks, opportunities, suggested actions, KPIs needing review, and data quality notes.
- **DAX / SQL Explainer** — paste a measure or query, get a plain-English breakdown.
- **Multi-theme platform** — 5 built-in themes (Light, Dark, Midnight, Slate, Solarized), 6 accent palettes, 2 density modes, customizable sidebar.
- **Fully customisable** — workspace name, tagline, your display name, currency, AI provider key — all persisted to your browser.

---

## Screenshots

> _Add screenshots of the Command Center, KPI Detail, AI Explainer, Lineage Map, Executive Brief and DAX/SQL Explainer here._

```
docs/screenshots/command-center.png
docs/screenshots/kpi-detail.png
docs/screenshots/ai-explainer.png
docs/screenshots/lineage-map.png
docs/screenshots/executive-brief.png
docs/screenshots/dax-sql-explainer.png
docs/screenshots/settings.png
```

---

## Architecture

```
   Source systems        →   OpenKPI Knowledge Layer   →   AI Agent Layer
 (SAP, Workday,              (definitions, lineage,        (grounded answers,
  Coupa, Salesforce,          owners, limitations,          briefs, DAX/SQL
  TM1, SQL, Excel, …)         confidence)                   translation)
                                    ↓
                          Governance Layer
                        (certification, audit,
                          confidence scoring)
                                    ↓
                         User Experience
                  (Command Center, Catalog, Explainer,
                   Lineage Map, Brief, DAX/SQL, Settings)
```

See [docs/architecture.md](docs/architecture.md) for the full picture.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **CSS Modules + plain CSS** — no Tailwind, no CSS-in-JS runtime
- **CSS variable–driven theming** — themes/accents are pure CSS, switched via `data-theme` / `data-accent` on `<html>`
- **lucide-react** — icon set
- **Custom SVG charts** — small Sparkline + TrendChart components (no chart dependency)
- **Mock data + deterministic mock AI** — no external API required to demo

The codebase is structured so a FastAPI / Postgres backend can be added without UI changes.

---

## Getting started

Requires **Node.js 18+**.

```bash
# 1. Install dependencies
npm install

# 2. (Optional) copy the env example for AI providers
cp .env.example .env.local

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

The MVP runs in **mock mode** by default — no API key required. To wire a real LLM, open **Settings → AI Provider**, pick OpenAI / Anthropic / Azure OpenAI, and paste your key. (For production deploys, move the key to a server-side env var and call the LLM from a Next.js route handler — see the open-source positioning doc.)

### Scripts

| Command         | What it does                          |
| --------------- | ------------------------------------- |
| `npm run dev`   | Start the local dev server            |
| `npm run build` | Production build                      |
| `npm run start` | Run the production build              |
| `npm run lint`  | Lint with `next/core-web-vitals`      |

---

## Deployment

A live demo runs at **<https://openstudio.oneplaceplatform.com>**, hosted on Hetzner behind a Coolify-managed Traefik proxy.

The repo holds **no secrets** — `.gitignore` blocks every `.env*` variant except the safe `.env.example` placeholder. Real API keys live only on your laptop (`.env.local`) and on the production server (`.env`), copied via `scp` during the one-command deploy:

```bash
OPENKPI_SSH_HOST=root@<your-hetzner-ip> ./deploy/hetzner/deploy.sh
```

See [docs/deploy.md](docs/deploy.md) for the full deployment guide, including how the secret-handling works end-to-end and what to do if a key ever leaks.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md). High level:

- **Phase 1** — Mock MVP (this release)
- **Phase 2** — CSV / Excel upload
- **Phase 3** — Postgres backend
- **Phase 4** — Real LLM integration
- **Phase 5** — Power BI metadata import
- **Phase 6** — SQL Server / Azure SQL connectors
- **Phase 7** — Role-based access and audit logs
- **Phase 8** — Enterprise deployment templates

---

## Open-source positioning

See [docs/open-source-positioning.md](docs/open-source-positioning.md).

OpenKPI is **not just a chatbot**. It is a KPI governance, lineage and explanation *layer* for BI teams — independent of BI tool, swappable AI provider, friendly to your existing stack.

---

## Contributing

Contributions welcome. Suggested first issues:

- Add a new theme (e.g. "Notion", "Linear", "GitHub")
- Add a new source-system icon to the lineage map
- Add a new accent palette (gold, sky, lime)
- Wire up the AI Explainer to a real provider (OpenAI route handler)
- Add CSV upload (Phase 2 of the roadmap)

Please file an issue first for anything larger than a small UI tweak so the design stays coherent.

---

## License

MIT — see [LICENSE](LICENSE).
