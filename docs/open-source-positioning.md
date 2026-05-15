# Open-source positioning

## What OpenKPI Studio is

OpenKPI Studio is an **open-source KPI governance, lineage and explanation layer** for enterprise analytics teams. It sits *between* source systems and dashboards as a metadata + AI layer, independent of any BI tool.

## What it is not

- **Not just a chatbot.** A wrapped LLM can hallucinate that "Attrition Rate" includes contingent workers when it doesn't. OpenKPI grounds every answer in the certified definition; the agent cannot invent formulas.
- **Not another BI tool.** OpenKPI doesn't replace Power BI, Tableau, Looker, Sigma or Metabase. It explains *what they show*.
- **Not a data catalog.** Catalogs document *tables*. OpenKPI documents *KPIs* — the business measures that show up in the board pack, with their formulas, lineage, owners and limitations.
- **Not vendor lock-in.** AI provider is swappable. Theme is swappable. Backend is swappable. The schema is open.

## Why open source

Enterprise analytics teams have been burned by closed "AI BI" tools:

- The vendor's AI hallucinates formulas the team didn't write.
- You can't see what the agent did or why.
- The metadata lives in the vendor's cloud — exporting it is painful.
- One AI provider is hard-coded. You can't bring your own model.

OpenKPI is **open** so analytics teams can:

- **Audit it.** The grounding logic is in [`src/lib/mockAI.ts`](../src/lib/mockAI.ts) — you can read it.
- **Extend it.** Add a new source system in a TypeScript file. Add a new theme in a CSS block. Add a new accent in three lines.
- **Self-host it.** Behind your firewall, with your own LLM endpoint.
- **Stay in control of the metadata.** Your KPI definitions are *yours*, in a schema you can read and back up.

## Who it is for

| Persona                       | What OpenKPI gives them                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| **Head of Data / Analytics**  | One source of truth for "what does this KPI mean", with governance     |
| **Data steward**              | Certification workflow + audit log + confidence signals                |
| **Senior analyst**            | Stops being a human FAQ; the agent answers L1 KPI questions            |
| **Business leader (CFO, CPO)**| Trusted dashboards: every number on a board pack has a definition page |
| **Data engineer**             | Lineage map their stakeholders can read without learning DBT graphs    |

## Differentiation vs adjacent tools

- **vs Power BI / Tableau / Looker** — OpenKPI is the *explanation layer* on top, not a replacement. Their KPIs become OpenKPI catalogue entries.
- **vs Atlan / Collibra / Alation** — those are data catalogues (tables, columns). OpenKPI is a *KPI catalogue* (business measures). They are complementary, and OpenKPI can import lineage from them in phase 5+.
- **vs vendor-bundled AI** — OpenKPI is BI-tool-agnostic and LLM-agnostic. You can bring your own model and your own dashboards.
- **vs a wrapped ChatGPT** — OpenKPI's agent is grounded in your certified metadata. It cites sources and confidence. It cannot invent formulas.

## Distribution strategy

- **GitHub-first.** Every PR is a public artefact.
- **One-click LinkedIn-grade screenshots.** The MVP is intentionally designed to look premium so analytics leaders can share it on LinkedIn and inside their own orgs.
- **Pluggable from day one.** The repo ships with mock data so anyone can clone-and-demo in 60 seconds. The same repo upgrades to a Postgres + LLM deployment without UI changes.
- **MIT licensed.** Use it commercially, embed it, fork it.

## What "good" looks like in 12 months

- The Knowledge Layer schema becomes a small de-facto standard for "how to describe a KPI".
- Enterprise analytics teams self-host OpenKPI behind their SSO, with their own LLM endpoint.
- Contributors ship connectors for the major BI tools, ERPs and HRIS systems.
- The AI Explainer's grounding logic is auditable, replicable, and respected by data stewards.

That is the bar. Everything in the roadmap serves it.
