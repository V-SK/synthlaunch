#!/usr/bin/env bash
set -o pipefail

CUSTODY_ADDR=${CUSTODY_ADDR:-0x3Fa33A0fb85f11A901e3616E10876d10018f43B7}
BSC_SCAN_API_URL=${BSC_SCAN_API_URL:-https://api.bscscan.com/api}
BSCSCAN_ACTION=${BSCSCAN_ACTION:-txlistinternal}
SCAN_LIMIT=${SCAN_LIMIT:-50}
START_BLOCK=${START_BLOCK:-0}
END_BLOCK=${END_BLOCK:-99999999}
THRESHOLD_BNB=${THRESHOLD_BNB:-1}

CURL_TIMEOUT=${CURL_TIMEOUT:-12}
CURL_OPTS=(-sS --max-time "$CURL_TIMEOUT" --connect-timeout 5)

ok() {
  echo "[OK] $*"
}

alert() {
  echo "[ALERT] $*"
}

if [ -z "${BSCSCAN_API_KEY:-}" ]; then
  alert "BSCSCAN_API_KEY is required to scan custody transactions"
  exit 1
fi

url="${BSC_SCAN_API_URL}?module=account&action=${BSCSCAN_ACTION}&address=${CUSTODY_ADDR}&startblock=${START_BLOCK}&endblock=${END_BLOCK}&page=1&offset=${SCAN_LIMIT}&sort=desc&apikey=${BSCSCAN_API_KEY}"

resp=$(curl "${CURL_OPTS[@]}" "$url" 2>/dev/null || true)
if [ -z "$resp" ]; then
  alert "BscScan API no response"
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  CUSTODY_ADDR="$CUSTODY_ADDR" THRESHOLD_BNB="$THRESHOLD_BNB" SCAN_LIMIT="$SCAN_LIMIT" \
    python3 - <<'PY' <<<"$resp"
import os, sys, json, decimal, datetime

addr = os.environ.get("CUSTODY_ADDR", "").lower()
threshold_bnb = os.environ.get("THRESHOLD_BNB", "1")
scan_limit = os.environ.get("SCAN_LIMIT", "0")

try:
    data = json.load(sys.stdin)
except Exception:
    print("[ALERT] Failed to parse BscScan response")
    sys.exit(1)

status = str(data.get("status", ""))
message = str(data.get("message", ""))

if status != "1":
    if message.lower() == "no transactions found":
        print(f"[OK] No transactions found for custody (limit {scan_limit})")
        sys.exit(0)
    print(f"[ALERT] BscScan API error: {message} {data.get('result', '')}")
    sys.exit(1)

result = data.get("result", [])
if not isinstance(result, list):
    print("[ALERT] Unexpected BscScan result format")
    sys.exit(1)

try:
    threshold = decimal.Decimal(threshold_bnb) * decimal.Decimal(10 ** 18)
except Exception:
    threshold = decimal.Decimal(10 ** 18)

alerts = []
for tx in result:
    frm = str(tx.get("from", "")).lower()
    if frm != addr:
        continue
    try:
        value = decimal.Decimal(str(tx.get("value", "0")))
    except Exception:
        continue
    if value > threshold:
        bnb = value / decimal.Decimal(10 ** 18)
        ts = tx.get("timeStamp")
        if ts:
            try:
                tstr = datetime.datetime.utcfromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S UTC")
            except Exception:
                tstr = "unknown time"
        else:
            tstr = "unknown time"
        alerts.append({
            "bnb": bnb,
            "to": tx.get("to", ""),
            "hash": tx.get("hash", ""),
            "time": tstr,
        })

if alerts:
    for item in alerts:
        print(f"[ALERT] Large withdrawal: {item['bnb']:.6f} BNB to {item['to']} at {item['time']} tx={item['hash']}")
    sys.exit(1)

print(f"[OK] No withdrawals > {threshold_bnb} BNB in last {len(result)} txs")
PY
  exit $?
fi

alert "python3 not available to parse BscScan JSON"
exit 1
