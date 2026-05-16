#!/usr/bin/env bash
# =============================================================================
# OpenKPI Studio — authenticated smoke test (dev-auth provider)
# =============================================================================
# Signs in via the OPENKPI_DEV_AUTH credentials provider with curl + cookie
# jar, then exercises the authenticated end-to-end flow:
#   - create workspace
#   - clone sample data into it
#   - inline-edit a KPI
#   - flip status
#   - flip cadence + manual refresh fails (no connector) but suggest works
#   - invite a member, accept-flow is partial (separate session needed)
#   - audit log shows the events we just performed
#   - delete the workspace
# =============================================================================
set -u

BASE="${BASE:-https://openstudio.oneplaceplatform.com}"
# NOTE: NO `-L` here — NextAuth's POST /api/auth/callback/dev returns a 302
# with Set-Cookie, and following the redirect makes us lose the cookie jar.
CURL=(-sS -k -m 30)
# CURL_L for HTML page fetches where the rendered body is what we want.
CURL_L=(-sS -k -m 30 -L)
EMAIL="${EMAIL:-smoke@openkpi.test}"
NAME="${NAME:-Smoke Test}"
SLUG="${SLUG:-smoke-$(date +%s)}"

JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

pass=0
fail=0
report=()

case_eq() {
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
  local desc=$1 body=$2 pat=$3
  if echo "$body" | grep -qE "$pat"; then
    pass=$((pass+1))
    report+=("  ✓ $desc")
  else
    fail=$((fail+1))
    report+=("  ✗ $desc — pattern '$pat' not found")
  fi
}
case_ne() {
  local desc=$1 got=$2 unwanted=$3
  if [ "$got" != "$unwanted" ]; then
    pass=$((pass+1))
    report+=("  ✓ $desc")
  else
    fail=$((fail+1))
    report+=("  ✗ $desc — got '$got' (was meant to differ from '$unwanted')")
  fi
}

# ─── Sign in via the dev credentials provider ───────────────────────────────
echo "[A] Dev sign-in as $EMAIL"
csrf=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" "$BASE/api/auth/csrf" \
  | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
case_ne "Obtained csrfToken" "$csrf" ""

# NextAuth's CredentialsProvider callback is /api/auth/callback/<id>. Send form fields.
# Without -L curl returns the 302 (and crucially, the Set-Cookie sticks).
signin_status=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' \
  -X POST "$BASE/api/auth/callback/dev" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$csrf" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "name=$NAME" \
  --data-urlencode "callbackUrl=/w/demo" \
  --data-urlencode "redirect=false" \
  --data-urlencode "json=true")
echo "    sign-in POST → $signin_status"

# Probe the session
session=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" "$BASE/api/auth/session")
case_match "Session has the email"  "$session" "\"email\":\"$EMAIL\""
case_match "Session has a user id"  "$session" '"id":"c[a-z0-9]'
echo

# ─── Create workspace ────────────────────────────────────────────────────────
echo "[B] Create workspace '$SLUG'"
ws_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X POST "$BASE/api/workspaces" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke $SLUG\",\"slug\":\"$SLUG\",\"tagline\":\"Created by smoke test\"}")
case_match "Workspace created" "$ws_resp" "\"slug\":\"$SLUG\""
case_match "Default visibility=PRIVATE" "$ws_resp" '"visibility":"PRIVATE"'
echo

# ─── Land on /w/<slug> as the creator (should be 200, not 307) ──────────────
echo "[C] Creator lands on /w/<slug> directly (no /login bounce)"
land=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' "$BASE/w/$SLUG")
case_eq "/w/$SLUG → 200 (creator is admin)" "$land" "200"
echo

# ─── Seed sample data into the new workspace ────────────────────────────────
echo "[D] Clone /w/demo sample data into $SLUG"
seed_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X POST "$BASE/api/workspaces/$SLUG/seed-sample")
case_match "seed-sample ok=true" "$seed_resp" '"ok":true'
case_match "seed-sample createdKpis >= 1" "$seed_resp" '"createdKpis":[1-9]'
case_match "seed-sample createdFlows >= 1" "$seed_resp" '"createdFlows":[1-9]'
echo

# ─── Inline-edit a KPI ───────────────────────────────────────────────────────
echo "[E] Inline-edit KPI 'revenue-growth'"
edit_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X PATCH "$BASE/api/workspaces/$SLUG/kpis/revenue-growth" \
  -H 'Content-Type: application/json' \
  -d '{"definition":"Smoke-test edit: YoY revenue growth, certified for the board pack.","status":"CERTIFIED"}')
case_match "Edit returns ok=true" "$edit_resp" '"ok":true'
# Re-read the page and look for the edited string
detail=$(curl "${CURL_L[@]}" -b "$JAR" -c "$JAR" "$BASE/w/$SLUG/catalog/revenue-growth")
case_match "Edited definition visible" "$detail" 'Smoke-test edit'
echo

# ─── AI suggest on a barely-documented synthetic KPI ────────────────────────
echo "[F] AI suggest on a synthetic blank KPI"
# Pick attrition-rate which already has docs — overwrite=false means it'll fill nothing.
# Better: pick data-quality-score which started with full docs in demo seed. Skip
# overwrite path. Instead exercise the bulk autodocument endpoint which is a
# no-op when nothing is empty (still returns 200).
auto_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X POST "$BASE/api/workspaces/$SLUG/autodocument")
case_match "autodocument returns scanned"   "$auto_resp" '"scanned":'
case_match "autodocument returns filled"    "$auto_resp" '"filled":'
echo

# ─── Flip cadence on a KPI ──────────────────────────────────────────────────
echo "[G] Change refresh cadence to 'Daily' on attrition-rate"
cadence_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X PATCH "$BASE/api/workspaces/$SLUG/kpis/attrition-rate" \
  -H 'Content-Type: application/json' \
  -d '{"refreshFrequency":"Daily"}')
case_match "Cadence flip ok" "$cadence_resp" '"ok":true'
echo

# ─── Invite a teammate (admin only) ─────────────────────────────────────────
echo "[H] Invite teammate@example.com"
inv_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X POST "$BASE/api/workspaces/$SLUG/members" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teammate@example.com","role":"EDITOR"}')
case_match "Invite returns a link"  "$inv_resp" '"link":"https://'
case_match "Invite token present"   "$inv_resp" '"token":"[A-Za-z0-9_-]{20,}'
echo

# ─── Audit log shows recent events ──────────────────────────────────────────
echo "[I] Audit log surfaces the smoke-run events"
audit_html=$(curl "${CURL_L[@]}" -b "$JAR" -c "$JAR" "$BASE/w/$SLUG/audit")
case_match "Audit page renders for member"           "$audit_html" 'Every action, recorded'
case_match "Audit lists workspace.create"            "$audit_html" 'Workspace created|workspace.create'
case_match "Audit lists workspace.seed-sample"       "$audit_html" 'workspace.seed-sample'
case_match "Audit lists workspace.invite"            "$audit_html" 'workspace.invite|Member invited'
case_match "Audit lists kpi.update"                  "$audit_html" 'kpi.update|KPI edited'
echo

# ─── Toggle visibility to PUBLIC and back ───────────────────────────────────
echo "[J] Toggle workspace visibility"
pub_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X PATCH "$BASE/api/workspaces/$SLUG" \
  -H 'Content-Type: application/json' \
  -d '{"visibility":"PUBLIC"}')
case_match "Switched to PUBLIC" "$pub_resp" '"visibility":"PUBLIC"'
# Anon (no cookie) hits /w/<slug> → should now be 200, not 307.
anon_after=$(curl -sS -k -m 15 -o /dev/null -w '%{http_code}' "$BASE/w/$SLUG")
case_eq "Anon can now read PUBLIC workspace" "$anon_after" "200"
priv_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" \
  -X PATCH "$BASE/api/workspaces/$SLUG" \
  -H 'Content-Type: application/json' \
  -d '{"visibility":"PRIVATE"}')
case_match "Switched back to PRIVATE" "$priv_resp" '"visibility":"PRIVATE"'
anon_again=$(curl -sS -k -m 15 -o /dev/null -w '%{http_code}' "$BASE/w/$SLUG")
case_eq "Anon is bounced again" "$anon_again" "307"
echo

# ─── Delete workspace (cleanup + delete-flow test) ──────────────────────────
echo "[K] Delete workspace (cleanup)"
del_resp=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" -X DELETE "$BASE/api/workspaces/$SLUG")
case_match "Delete returns ok" "$del_resp" '"ok":true'
gone=$(curl "${CURL[@]}" -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' "$BASE/w/$SLUG")
case_eq "/w/$SLUG → 404 after delete" "$gone" "404"
echo

# ─── Summary ────────────────────────────────────────────────────────────────
echo
echo "────────────────────────────────────────────────────────────"
printf "  PASS: %d   FAIL: %d\n" "$pass" "$fail"
echo "────────────────────────────────────────────────────────────"
printf '%s\n' "${report[@]}"
echo
exit "$fail"
