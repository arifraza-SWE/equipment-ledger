#!/usr/bin/env bash
# Sends the same issue request three times with one Idempotency-Key and shows that it lands once.
# Usage: scripts/replay-request.sh [assetId] [workerId]   (API_URL defaults to http://localhost:4000)
set -euo pipefail

asset_id="${1:-DRL-003}"
worker_id="${2:-WKR-001}"
api_url="${API_URL:-http://localhost:4000}"
effective_at="$(date -u -v-5M +%Y-%m-%dT%H:%M:00Z 2>/dev/null || date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:00Z)"
key="$(uuidgen | tr '[:upper:]' '[:lower:]')"
body="{\"assetId\":\"$asset_id\",\"workerId\":\"$worker_id\",\"keeperId\":\"KPR-01\",\"effectiveAt\":\"$effective_at\"}"

echo "Idempotency-Key: $key"
for attempt in 1 2 3; do
  printf 'attempt %s: ' "$attempt"
  curl -s -o /dev/null -w 'HTTP %{http_code}  idempotency-replayed=%header{idempotency-replayed}\n' \
    -X POST "$api_url/movements/issues" \
    -H 'content-type: application/json' \
    -H "idempotency-key: $key" \
    -d "$body"
done
echo
echo "issue entries for $asset_id at $effective_at in the ledger:"
curl -s "$api_url/assets/$asset_id/history" | python3 -c "
import json,sys
history=json.load(sys.stdin)
matches=[m for m in history['movements'] if m['movement']['type']=='issue' and m['movement']['effectiveAt']=='${effective_at%Z}.000Z']
print('  ' + str(len(matches)))
"
