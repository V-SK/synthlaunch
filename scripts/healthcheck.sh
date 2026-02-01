#!/bin/bash
# SynthLaunch Health Check Script
# Checks both deployment domains and compares results

set -euo pipefail

DOMAIN1="https://synthlaunch.vercel.app"
DOMAIN2="https://synthlaunch.fun"
TIMEOUT=15
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  SynthLaunch Health Check"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

check_domain() {
  local domain="$1"
  local label="$2"

  echo "--- $label ($domain) ---"

  local response
  local http_code
  local tmp_file=$(mktemp)

  http_code=$(curl -s -o "$tmp_file" -w "%{http_code}" --max-time "$TIMEOUT" "$domain/api/health" 2>/dev/null || echo "000")

  if [ "$http_code" = "000" ]; then
    echo -e "  ${RED}FAIL${NC}: Connection timeout or error"
    FAIL=$((FAIL + 1))
    rm -f "$tmp_file"
    return 1
  fi

  if [ "$http_code" != "200" ]; then
    echo -e "  ${RED}FAIL${NC}: HTTP $http_code"
    FAIL=$((FAIL + 1))
    rm -f "$tmp_file"
    return 1
  fi

  response=$(cat "$tmp_file")
  rm -f "$tmp_file"

  local status
  status=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")

  if [ "$status" = "ok" ]; then
    echo -e "  Status: ${GREEN}OK${NC}"
    PASS=$((PASS + 1))
  elif [ "$status" = "degraded" ]; then
    echo -e "  Status: ${YELLOW}DEGRADED${NC}"
    FAIL=$((FAIL + 1))
    # Show which checks failed
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for name, check in data.get('checks', {}).items():
    if check.get('status') == 'error':
        err = check.get('error', 'unknown')
        print(f'    ✗ {name}: {err}')
    else:
        latency = check.get('latencyMs', '?')
        print(f'    ✓ {name}: {latency}ms')
" 2>/dev/null
  elif [ "$status" = "error" ]; then
    echo -e "  Status: ${RED}ERROR${NC} — All checks failed"
    FAIL=$((FAIL + 1))
  else
    echo -e "  Status: ${RED}UNKNOWN${NC} ($status)"
    FAIL=$((FAIL + 1))
  fi

  # Show individual checks
  echo "  Checks:"
  echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for name, check in data.get('checks', {}).items():
    s = check.get('status', '?')
    latency = check.get('latencyMs', '?')
    extra = ''
    if 'tokenCount' in check: extra = f', tokens={check[\"tokenCount\"]}'
    if 'blockNumber' in check: extra = f', block={check[\"blockNumber\"]}'
    if 'price' in check: extra = f', price=\${check[\"price\"]}'
    if 'error' in check: extra = f', error={check[\"error\"]}'
    icon = '✓' if s == 'ok' else '✗'
    print(f'    {icon} {name}: {s} ({latency}ms{extra})')
" 2>/dev/null || echo "    (Could not parse response)"

  echo ""
  echo "$response"  # Return raw for comparison
}

echo ""
RESP1=$(check_domain "$DOMAIN1" "synthlaunch.vercel.app" 2>&1 | head -20)
echo "$RESP1"
echo ""

RESP2=$(check_domain "$DOMAIN2" "synthlaunch.fun" 2>&1 | head -20)
echo "$RESP2"
echo ""

echo "============================================"
echo "  Summary"
echo "============================================"

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC} ($PASS/$((PASS + FAIL)))"
  exit 0
else
  echo -e "  ${RED}SOME CHECKS FAILED${NC} (pass=$PASS, fail=$FAIL)"
  exit 1
fi
