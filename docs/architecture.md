# Architecture

OpenKPI Studio is structured as a five-layer system. The MVP implements all five in-process (front-end only with mock data). The architecture is deliberately separable so each layer can be replaced or extended without touching the others.

```
+----------------------+   +-----------------------+   +-----------------------+
|  Source Systems      |   |  OpenKPI Knowledge    |   |  AI Agent Layer       |
|                      |   |  Layer                |   |                       |
|  SAP · Workday ·     | → |  KPI definitions      | → |  Grounded responses   |
|  Coupa · Salesforce  |   |  Formula registry     |   |  Brief generator      |
|  TM1 · SQL · Excel · |   |  Source-system        |   |  DAX/SQL explainer    |
|  Power BI · Board    |   |  lineage              |   |  Confidence model     |
+----------------------+   |  Owner registry       |   |                       |
                           |  Limitations          |   +-----------------------+
                           +-----------------------+               |
                                       ↓                           ↓
                           +-----------------------+   +-----------------------+
                           |  Governance Layer     |   |  User Experience      |
                           |                       |   |                       |
                           |  Certification status |   |  Command Center       |
                           |  Confidence scoring   | → |  Catalog & Detail     |
                           |  Audit log            |   |  Lineage Map          |
                           |  Steward sign-off     |   |  AI Explainer         |
                           +-----------------------+   |  Executive Brief      |
                                                       |  DAX / SQL Explainer  |
                                                       |  Settings (custom.)   |
                                                       +-----------------------+
```

## Layers in detail

### 1. Source systems
Authoritative systems-of-record. **OpenKPI does not store transactional data** — it stores *metadata about* the KPIs that summarise that data.

### 2. Knowledge layer
For every KPI:

- **Definition** — what the KPI means in business terms
- **Formula** — how it is calculated (SQL / DAX / business rule)
- **Source system** — where the underlying data lives
- **Owner / steward** — who certifies it
- **Refresh cadence** — how often it updates
- **Lineage** — full path from source to dashboard
- **Limitations** — what it excludes, edge cases, caveats
- **Related dashboards** — where the KPI is consumed
- **Related KPIs** — what to triangulate against

In the MVP these live in TypeScript files under [`src/lib/data/`](../src/lib/data). In phase 3+ they move to Postgres.

### 3. AI agent layer
The agent is **grounded** — it only answers about KPIs that exist in the knowledge layer, and it cites the metadata it used. The MVP uses [`src/lib/mockAI.ts`](../src/lib/mockAI.ts) which classifies the user's question (definition / formula / movement / source / trust / next-step / compare) and emits a structured response.

A real LLM provider (OpenAI / Anthropic / Azure OpenAI) plugs in by:

1. Replacing the body of `generateMockAIResponse` with a call to the provider, **constraining the system prompt to the KPI's metadata** (RAG-style).
2. Adding the API key to a server-side env var, not to the client.
3. Calling the provider from a Next.js Route Handler (`src/app/api/explain/route.ts`).

### 4. Governance layer
Three signals attached to every KPI:

- **Status** — Certified / Draft / Needs Review
- **Confidence score** (0–100) — composite of freshness, completeness, definition stability
- **Owner / steward** — who is accountable

The MVP holds these in TypeScript; in production they belong in Postgres with an audit log table.

### 5. User experience
Pages map 1:1 to user needs:

| Page              | User question                                |
| ----------------- | -------------------------------------------- |
| Command Center    | "What's the state of my KPI portfolio?"      |
| Catalog & detail  | "What does this KPI actually mean?"          |
| Lineage Map       | "Where does this number come from?"          |
| AI Explainer      | "Why did it move? Can I trust it?"           |
| Executive Brief   | "Give me a 1-pager for the board cycle."     |
| DAX / SQL         | "Explain this measure in plain English."     |
| Settings          | "Make this look and feel like our company."  |

## Code organisation

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Command Center
│   ├── catalog/                  # KPI catalog list + detail
│   ├── explainer/                # AI chat
│   ├── lineage/                  # Lineage Map
│   ├── brief/                    # Executive Brief
│   ├── dax-sql/                  # DAX / SQL Explainer
│   ├── about/                    # About
│   └── settings/                 # Workspace customisation
├── components/
│   ├── layout/                   # Shell, Sidebar, TopBar, Hero
│   ├── kpi/                      # KPICard, SummaryCard
│   ├── ui/                       # StatusBadge, ConfidenceDial
│   ├── charts/                   # Sparkline, TrendChart
│   └── providers/                # ThemeProvider
├── lib/
│   ├── data/                     # Sample KPIs, lineage, briefs (replace w/ DB)
│   ├── mockAI.ts                 # Deterministic mock AI (replace w/ LLM)
│   └── utils.ts                  # Tiny helpers (cx, formatters)
└── types/                        # All shared TypeScript types
```

## Styling system

OpenKPI Studio deliberately **does not use Tailwind**. Styling is:

- **CSS variables** for design tokens (theme + accent + density), defined in [`globals.css`](../src/app/globals.css)
- **CSS Modules** per component for local styles
- **A tiny set of global class names** for reusable primitives (`.card`, `.btn`, `.chip`, `.badge`, `.input`)

Themes are switched by setting `data-theme="..."` on `<html>`. Adding a new theme is one block of CSS variables in `globals.css` — no JavaScript change required.

## Future architecture (phase 3+)

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Next.js (UI)   │ ─→ │  FastAPI service │ ─→ │  Postgres        │
│                 │    │  /kpis           │    │  - kpi           │
│  Route handler  │ ─→ │  /lineage        │    │  - lineage_step  │
│  /api/explain   │    │  /explain        │    │  - audit_event   │
│                 │    │  (proxies LLM)   │    │  - data_quality  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ↓
                       LLM provider (OpenAI / Anthropic / Azure)
```

The UI doesn't change — only the data fetcher (`src/lib/data/*`) is swapped from local TS modules to API calls.
