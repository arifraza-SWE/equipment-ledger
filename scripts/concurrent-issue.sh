#!/usr/bin/env bash
# Fires N issue requests for one asset at the same moment and counts the answers.
# Usage: scripts/concurrent-issue.sh [assetId] [count]   (API_URL defaults to http://localhost:4000)
set -euo pipefail

asset_id="${1:-HARN-014}"
count="${2:-10}"
api_url="${API_URL:-http://localhost:4000}"
effective_at="$(date -u -v-5M +%Y-%m-%dT%H:%M:00Z 2>/dev/null || date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:00Z)"
workers=(WKR-001 WKR-002 WKR-003 WKR-005 WKR-012)
outdir="$(mktemp -d)"

for i in $(seq 1 "$count"); do
  worker="${workers[$(( (i - 1) % ${#workers[@]} ))]}"
  key="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  (
    curl -s -o "$outdir/$i.json" -w '%{http_code}' \
      -X POST "$api_url/movements/issues" \
      -H 'content-type: application/json' \
      -H "idempotency-key: $key" \
      -d "{\"assetId\":\"$asset_id\",\"workerId\":\"$worker\",\"keeperId\":\"KPR-01\",\"effectiveAt\":\"$effective_at\"}" \
      > "$outdir/$i.code"
  ) &
done
wait

echo "$count simultaneous issues of $asset_id at $effective_at"
cat "$outdir"/*.code | sort | uniq -c | awk '{printf "  %s x HTTP %s\n", $1, $2}'
echo
echo "one of the refusals:"
grep -l '"asset_already_issued"' "$outdir"/*.json | head -1 | xargs -I{} sh -c "python3 -c \"import json,sys; print('  ' + json.load(open('{}'))['message'])\""
echo
echo "holder according to the ledger:"
curl -s "$api_url/assets/$asset_id" | python3 -c 'import json,sys; s=json.load(sys.stdin); h=s["holding"]; print("  " + (h["worker"]["fullName"] + " (" + h["worker"]["workerId"] + ") since " + h["effectiveAt"] if h else "nobody"))'
rm -rf "$outdir"
