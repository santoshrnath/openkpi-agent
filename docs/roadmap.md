# Roadmap

## What's shipped

| | Description | Status |
| --- | --- | --- |
| **1. Multi-workspace UI** | `/w/[slug]/...` route group, DB-backed; `/` → `/w/demo` redirect | ✅ |
| **2. AI Explainer** | Claude Sonnet 4.6 grounded in KPI metadata, structured JSON response, audit-logged | ✅ |
| **3. Auth + ACL** | NextAuth (Google + Email + dev-credentials), `Workspace.visibility`, 4-tier Membership role, invitation tokens | ✅ |
| **4. CSV upload** | drag/drop, fuzzy header aliases, per-row error display, idempotent re-upload | ✅ |
| **5. SQL connector framework** | encrypted-at-rest credentials, Postgres driver (read-only transaction, SSL-when-not-private), paste-SQL-→-live-KPI flow | ✅ |
| **6. Scheduled refresh** | host cron `*/5 * * * *` → Bearer-auth endpoint → cadence-aware refresh, retry on transient DB blip | ✅ |
| **7. AI-assisted documentation** | per-KPI `Suggest with AI` button + workspace-level "Auto-document missing fields" bulk action; Claude drafts grounded, hedged docs | ✅ |
| **8. Inline KPI editing** | click-to-edit on every metadata field (definition, formula, limitations, owner, source, "why moved") | ✅ |
| **9. Quick status menu** | clickable badge on every card: Certified / Draft / Needs Review | ✅ |
| **10. Workspace settings** | rename, tagline, currency, visibility toggle, delete (admin-only, demo guarded) | ✅ |
| **11. Members + invites** | admin-only invite form, 14-day token links, accept flow at `/invite/[token]` | ✅ |
| **12. Audit log viewer** | paginated, action-filtered, pretty-formatted per kind | ✅ |
| **13. Onboarding wizard** | 3-tile choice on empty workspaces (Upload CSV / Connect DB / Use sample data) | ✅ |
| **14. Trend chart period selector** | All / 12m / 6m / 3m / YTD chips on KPI detail | ✅ |
| **15. Smoke + auth test suites** | 76 cases verifying end-to-end behaviour | ✅ |

## Next (autonomous)

| | Effort | Notes |
| --- | --- | --- |
| **Multi-period CSV upload UX**: column-mapping confirmation step before write | half day | Bigger upload safety net |
| **In-place catalog editing**: table view at `/w/<slug>/catalog` with editable cells | half day | Bulk steward work |
| **Better empty states** on every page | 2 hours | Polish |
| **README screenshots refresh** | 1 hour (manual) | Marketing |

## Next (requires user credentials)

| | What you need to provide | Effort |
| --- | --- | --- |
| **Real Google OAuth** | OAuth client ID + secret from Google Cloud Console | ~30 min |
| **Email magic-link auth** | SMTP relay creds (Resend free tier recommended) | ~30 min |
| **Snowflake connector** | Snowflake account + warehouse + role with USAGE | ~3 days |
| **SQL Server / Azure SQL connector** | DB connection info | ~3 days |
| **BigQuery connector** | GCP service-account JSON | ~3 days |
| **Power BI metadata import** | Power BI Premium workspace + Azure AD app | ~5 days |
| **Slack alerts on refresh failure** | Slack incoming-webhook URL | ~half day |
| **Email alerts** | Same SMTP as magic-link | ~half day |

## Future (enterprise unlocks)

- **Embeddable KPI tiles** (a `<script>` tag a customer can drop on their intranet / Confluence)
- **Multi-workspace search** for signed-in users — find a KPI by name across every workspace you're a member of
- **Webhook outbound** on KPI status / value-change events
- **SSO via OIDC** (Okta, Azure AD, Google Workspace)
- **Audit-event export** (CSV / JSONL stream)
- **SOC 2 control mappings** documentation
- **Helm chart** for self-hosted Kubernetes deployments
- **Air-gapped install** with private LLM endpoint
