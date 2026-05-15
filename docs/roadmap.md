# Roadmap

OpenKPI Studio ships incrementally. Each phase is independently useful — you can stop at any phase and the product still works.

## Phase 1 — Mock MVP (this release)

- KPI Command Center with summary cards, filters, KPI grid
- KPI Catalog + detail page (definition, formula, lineage rail, AI panel)
- AI Explainer (chat-style with deterministic mock responses, sources, assumptions, confidence)
- Lineage Map (flow + details table + insights rail)
- Executive Brief (generated from sample portfolio)
- DAX / SQL Explainer
- Multi-theme platform (5 themes, 6 accents, 2 densities, sidebar style)
- Settings page (workspace identity, currency, AI provider, API key placeholder)

**Goal:** prove the user experience and the governance information model.

## Phase 2 — CSV / Excel upload

- Upload a CSV/Excel file of KPI definitions, history points and lineage steps
- Validation pass (required fields, formula well-formed, source system known)
- Persist to browser IndexedDB so the MVP is still backend-less
- "Reset to sample data" button in Settings → Data

**Goal:** customers can demo OpenKPI against their own KPI list in 10 minutes.

## Phase 3 — Postgres backend

- FastAPI service exposes `/kpis`, `/lineage`, `/explain`, `/brief`, `/audit`
- Postgres schema: `kpi`, `lineage_step`, `dashboard`, `audit_event`, `data_quality_test`
- Replace `src/lib/data/*` with API calls — no UI changes
- Docker Compose for local dev

**Goal:** team-shared, persistent KPI catalogue.

## Phase 4 — LLM integration

- Server-side route handler `/api/explain` calls OpenAI / Anthropic / Azure OpenAI
- Prompt is constrained to the KPI's metadata (RAG-style; the agent cannot hallucinate definitions)
- Confidence score blends the KPI's governance confidence with the model's logprobs
- Streaming responses in the AI Explainer

**Goal:** real plain-English explanations grounded in your knowledge layer.

## Phase 5 — Power BI metadata import

- Connect to Power BI workspace via REST API
- Import datasets, measures (DAX), and reports
- Map measures to KPIs in the catalogue automatically
- Surface DAX in the KPI detail page

**Goal:** the catalogue stays in sync with what's actually deployed.

## Phase 6 — SQL Server / Azure SQL connectors

- Read-only connections to source systems
- Run KPI formulas against live data (sandboxed, time-boxed)
- Show data-quality test results inline in the KPI card

**Goal:** the catalogue is *live*, not stale documentation.

## Phase 7 — Role-based access and audit logs

- SSO (OIDC) — pluggable provider
- Roles: Viewer, Editor, Steward, Admin
- Audit log table for every certification, edit, AI response
- Approval workflow for moving KPIs from Draft → Certified

**Goal:** enterprise-ready governance.

## Phase 8 — Enterprise deployment templates

- Helm chart for Kubernetes
- Terraform module for AWS / Azure / GCP
- Air-gapped install guide (private LLM endpoint)
- SOC 2 / ISO 27001 controls mapping

**Goal:** procurement-friendly for regulated industries.

---

## Out of scope (deliberately)

- **Building yet another BI tool.** OpenKPI works *with* your existing BI stack (Power BI, Tableau, Looker, Sigma, Metabase), not against it.
- **Storing transactional data.** OpenKPI stores metadata. Your warehouse stays the source of truth.
- **One vendor's LLM.** AI provider is pluggable from day one.
