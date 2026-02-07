#!/usr/bin/env bash
# SynthLaunch Health Monitor
set -o pipefail

BSC_RPC_URL=${BSC_RPC_URL:-https://bsc-dataseed.binance.org/}
NFA_ADDR=${NFA_ADDR:-0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19}
CUSTODY_ADDR=${CUSTODY_ADDR:-0x3Fa33A0fb85f11A901e3616E10876d10018f43B7}
FAILS=0

ok() { echo "[OK] $*"; }
alert() { echo "[ALERT] $*"; FAILS=$((FAILS+1)); }

# Check HTTP endpoint
check_http() {
  local code=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" "$2" 2>/dev/null || echo "000")
  [ "$code" = "200" ] && ok "$1 HTTP 200" || alert "$1 HTTP $code"
}

# Check BSC RPC
check_rpc() {
  local resp=$(curl -sS --max-time 10 -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
    "$BSC_RPC_URL" 2>/dev/null)
  local block=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(int(d.get('result','0x0'),16))" 2>/dev/null)
  [ -n "$block" ] && [ "$block" -gt 0 ] && ok "BSC RPC block $block" || alert "BSC RPC not responding"
}

# Check NFAv2 totalMinted
check_nfa() {
  local resp=$(curl -sS --max-time 10 -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$NFA_ADDR\",\"data\":\"0xa2309ff8\"},\"latest\"]}" \
    "$BSC_RPC_URL" 2>/dev/null)
  local minted=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result','0x'); print(int(r,16) if r and r!='0x' else '')" 2>/dev/null)
  [ -n "$minted" ] && ok "NFAv2 totalMinted $minted" || alert "NFAv2 totalMinted unreadable"
}

# Check Custody balance
check_custody() {
  local resp=$(curl -sS --max-time 10 -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBalance\",\"params\":[\"$CUSTODY_ADDR\",\"latest\"]}" \
    "$BSC_RPC_URL" 2>/dev/null)
  local wei=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result','0x0'); print(int(r,16))" 2>/dev/null)
  if [ -n "$wei" ]; then
    local bnb=$(python3 -c "print(f'{$wei/1e18:.4f}')")
    ok "Custody balance ${bnb} BNB"
  else
    alert "Custody balance unreadable"
  fi
}

echo "=== SynthLaunch Health Check $(date) ==="
check_http "synthlaunch.fun" "https://synthlaunch.fun"
check_http "api/health" "https://synthlaunch.fun/api/health"
check_rpc
check_nfa
check_custody
echo "=== Done: $FAILS failures ==="

exit $FAILS
