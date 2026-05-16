#!/usr/bin/env bash
# =============================================================================
# OpenKPI Studio — production smoke test
# =============================================================================
# Walks the major user journeys and reports PASS / FAIL per case.
#
# Usage:
#   BASE=https://openstudio.oneplaceplatform.com bash scripts/smoke.sh
#   BASE=http://127.0.0.1:3050 bash scripts/smoke.sh   # via Hetzner host
#
# No credentials required — uses the dev-auth credentials provider when
# enabled. Logs nothing sensitive.
# =============================================================================
set -u  # don't fail on the first miss — we want a report

BASE="${BASE:-https://openstudio.oneplaceplatform.com}"
CURL_FLAGS=(-sS -k -m 15)

pass=0
fail=0
report=()

case_eq() {
  # case_eq "Description" GOT WANT
  local desc=$1 got=$2 want=$3
  if [ "$got" = "$want" ]; then
    pass=$((pass+1))
    report+=("  ✓ $desc")
  else
    fail=$((fail+1))
    report+=("  ✗ $desc — expected '$want', got '$got'")
  fi
}

case_match() {
  # case_match "Description" BODY PATTERN
  local desc=$1 body=$2 pat=$3
  if echo "$body" | grep -qE "$pat"; then
    pass=$((pass+1))
    report+=("  ✓ $desc")
  else
    fail=$((fail+1))
    report+=("  ✗ $desc — pattern '$pat' not found")
  fi
}

http_status() {
  curl "${CURL_FLAGS[@]}" -o /dev/null -w "%{http_code}" "$@"
}

echo "▶  BASE=$BASE"
echo

# ─── 1. Anonymous public reads ──────────────────────────────────────────────
echo "[1] Anonymous public reads"
case_eq "/  → 307 to /w/demo"      "$(http_status -o /dev/null -w '%{http_code}|%{redirect_url}' "$BASE/" | cut -d'|' -f1)" "307"
case_eq "/w/demo  → 200"           "$(http_status "$BASE/w/demo")" "200"
case_eq "/w/demo/catalog → 200"    "$(http_status "$BASE/w/demo/catalog")" "200"
case_eq "/w/demo/lineage → 200"    "$(http_status "$BASE/w/demo/lineage")" "200"
case_eq "/w/demo/explainer → 200"  "$(http_status "$BASE/w/demo/explainer")" "200"
case_eq "/w/demo/brief → 200"      "$(http_status "$BASE/w/demo/brief")" "200"
case_eq "/w/demo/dax-sql → 200"    "$(http_status "$BASE/w/demo/dax-sql")" "200"
case_eq "/w/demo/about → 200"      "$(http_status "$BASE/w/demo/about")" "200"
case_eq "/w/demo/audit → 200"      "$(http_status "$BASE/w/demo/audit")" "200"
case_eq "/w/demo/members → 200"    "$(http_status "$BASE/w/demo/members")" "200"
case_eq "/w/demo/connections → 200" "$(http_status "$BASE/w/demo/connections")" "200"
case_eq "/w/demo/import → 200"     "$(http_status "$BASE/w/demo/import")" "200"
case_eq "/w/demo/settings → 200"   "$(http_status "$BASE/w/demo/settings")" "200"
case_eq "/login → 200"             "$(http_status "$BASE/login")" "200"
case_eq "/w/new → 200"             "$(http_status "$BASE/w/new")" "200"
echo

# ─── 2. Private workspace gate ──────────────────────────────────────────────
echo "[2] PRIVATE workspace gates anon to /login"
priv_code=$(curl "${CURL_FLAGS[@]}" -o /dev/null -w "%{http_code}" "$BASE/w/acme-finance")
case_eq "/w/acme-finance → 307"    "$priv_code" "307"
priv_loc=$(curl "${CURL_FLAGS[@]}" -o /dev/null -w "%{redirect_url}" "$BASE/w/acme-finance")
case_match "/w/acme-finance → /login?callbackUrl" "$priv_loc" "/login\\?callbackUrl=.*acme-finance"
echo

# ─── 3. Anon mutations should all 401 ───────────────────────────────────────
echo "[3] Anonymous mutations are 401/403/415"
case_eq "POST /api/workspaces (no body)              → 400" "$(http_status -X POST "$BASE/api/workspaces" -H 'Content-Type: application/json' -d '{}')" "400"
case_eq "POST /api/workspaces (valid body, anon)     → 401" "$(http_status -X POST "$BASE/api/workspaces" -H 'Content-Type: application/json' -d '{"name":"hack","slug":"hackworkspace"}')" "401"
case_eq "POST /api/workspaces/demo/import (anon)     → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/import" -H 'Content-Type: text/csv' -d 'name,value')" "401"
case_eq "POST /api/workspaces/demo/connections (anon) → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/connections" -H 'Content-Type: application/json' -d '{"kind":"POSTGRES","name":"x","url":"postgresql://x:y@h:5432/d"}')" "401"
case_eq "PATCH /api/workspaces/demo (anon)           → 401" "$(http_status -X PATCH "$BASE/api/workspaces/demo" -H 'Content-Type: application/json' -d '{"name":"oops"}')" "401"
case_eq "DELETE /api/workspaces/demo (anon)          → 401" "$(http_status -X DELETE "$BASE/api/workspaces/demo")" "401"
case_eq "POST /api/workspaces/demo/seed-sample (anon) → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/seed-sample")" "401"
case_eq "POST /api/workspaces/demo/autodocument (anon) → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/autodocument")" "401"
case_eq "POST /api/workspaces/demo/kpis/x/refresh (anon) → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/kpis/revenue-growth/refresh")" "401"
case_eq "POST /api/workspaces/demo/kpis/x/suggest (anon) → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/kpis/revenue-growth/suggest" -H 'Content-Type: application/json' -d '{}')" "401"
case_eq "PATCH /api/workspaces/demo/kpis/x (anon)    → 401" "$(http_status -X PATCH "$BASE/api/workspaces/demo/kpis/revenue-growth" -H 'Content-Type: application/json' -d '{"status":"DRAFT"}')" "401"
case_eq "POST /api/workspaces/demo/members (anon)    → 401" "$(http_status -X POST "$BASE/api/workspaces/demo/members" -H 'Content-Type: application/json' -d '{"email":"a@b.c","role":"VIEWER"}')" "401"
echo

# ─── 4. /api/explain is open for PUBLIC workspaces ──────────────────────────
echo "[4] AI Explainer (open on PUBLIC workspaces)"
explain_body=$(curl "${CURL_FLAGS[@]}" -X POST "$BASE/api/explain" -H 'Content-Type: application/json' \
  -d '{"kpiId":"revenue-growth","question":"What is Revenue Growth in one sentence?","workspaceSlug":"demo"}')
case_match "Returns provider=anthropic" "$explain_body" '"provider":"anthropic"'
case_match "Returns model=claude-sonnet-4-6" "$explain_body" '"model":"claude-sonnet-4-6"'
case_match "Returns non-empty answer" "$explain_body" '"answer":"[^"]{20,}"'
case_match "Returns sources array" "$explain_body" '"sources":\['
echo

# ─── 5. CRON endpoint requires Bearer token ─────────────────────────────────
echo "[5] /api/cron/refresh-due token gate"
case_eq "no token → 401" "$(http_status "$BASE/api/cron/refresh-due")" "401"
case_eq "wrong token → 401" "$(http_status -H "Authorization: Bearer wrong" "$BASE/api/cron/refresh-due")" "401"
echo

# ─── 6. Sample CSV template + import end-to-end ─────────────────────────────
echo "[6] CSV sample template (open GET)"
case_eq "GET /api/workspaces/demo/import/sample → 200" "$(http_status "$BASE/api/workspaces/demo/import/sample")" "200"
sample_body=$(curl "${CURL_FLAGS[@]}" "$BASE/api/workspaces/demo/import/sample")
case_match "Sample CSV has 'name,domain,value' header" "$sample_body" '^name,domain,value,'
case_match "Sample CSV has Revenue Growth row" "$sample_body" 'Revenue Growth'
echo

# ─── 7. UI structural checks (key strings exist) ────────────────────────────
echo "[7] UI structural checks"
home=$(curl "${CURL_FLAGS[@]}" -L "$BASE/w/demo")
case_match "Command Center hero copy"      "$home" "Turn KPI confusion"
case_match "Sparkline svg present"         "$home" "Sparkline_svg"
case_match "Status menu (KpiStatusMenu)"   "$home" "KpiStatusMenu_trigger"

catalog=$(curl "${CURL_FLAGS[@]}" -L "$BASE/w/demo/catalog")
case_match "Catalog hero copy"             "$catalog" "Every KPI"

detail=$(curl "${CURL_FLAGS[@]}" -L "$BASE/w/demo/catalog/revenue-growth")
case_match "Detail crumbs"                 "$detail" "Revenue Growth"
case_match "Inline-edit affordance"        "$detail" "InlineEdit_display"
case_match "Trend period chips"            "$detail" "TrendChart_periodBar"
case_match "AI Explanation rail"           "$detail" "AI Explanation"

audit=$(curl "${CURL_FLAGS[@]}" -L "$BASE/w/demo/audit")
case_match "Audit log hero copy"           "$audit" "Every action, recorded"

explainer=$(curl "${CURL_FLAGS[@]}" -L "$BASE/w/demo/explainer")
case_match "Explainer hero"                "$explainer" "Ask"

login=$(curl "${CURL_FLAGS[@]}" -L "$BASE/login")
case_match "Login dev-mode banner"         "$login" "Dev sign-in"
echo

# ─── Summary ────────────────────────────────────────────────────────────────
echo
echo "────────────────────────────────────────────────────────────"
printf "  PASS: %d   FAIL: %d\n" "$pass" "$fail"
echo "────────────────────────────────────────────────────────────"
printf '%s\n' "${report[@]}"
echo
exit "$fail"
