#!/usr/bin/env bash
# Test start-run then poll get-result. Loads key and URL from .env (INSFORGE_KEY + INSFORGE_URL).
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
BASE_URL="${INSFORGE_URL:?Set INSFORGE_URL in .env}"
ANON_KEY="${INSFORGE_KEY:?Set INSFORGE_KEY in .env}"

# Optional: pass request for Phase 2 (natural language). Default: no body = hello-world.
# Optional: "with-schema" = Phase 3 (outputSchema); "save-task" = Phase 4 (saveAsTask + taskName).
REQUEST="${1:-}"
MODE="${2:-}"
echo "Starting run..."
if [ "$MODE" = "with-schema" ]; then
  BODY='{"request":"'"${REQUEST:-top 5 cafes in Boston}"'","outputSchema":{"name":"string","rating":"number","address":"string"}}'
  RES=$(curl -s -X POST "$BASE_URL/functions/start-run" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d "$BODY")
elif [ "$MODE" = "save-task" ]; then
  BODY='{"request":"'"${REQUEST:-top 5 cafes in Boston}"'","outputSchema":{"name":"string","rating":"number","address":"string"},"saveAsTask":true,"taskName":"Boston cafes"}'
  RES=$(curl -s -X POST "$BASE_URL/functions/start-run" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d "$BODY")
elif [ -n "$REQUEST" ]; then
  RES=$(curl -s -X POST "$BASE_URL/functions/start-run" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d "{\"request\":\"$REQUEST\"}")
else
  RES=$(curl -s -X POST "$BASE_URL/functions/start-run" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY")
fi
echo "$RES"
RUN_ID=$(echo "$RES" | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$RUN_ID" ]; then
  echo "Failed to get runId. Response above."
  exit 1
fi
echo ""
echo "Polling for result (runId=$RUN_ID)..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  OUT=$(curl -s -X POST "$BASE_URL/functions/get-result" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d "{\"runId\":\"$RUN_ID\"}")
  STATUS=$(echo "$OUT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "$OUT"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  [ $i -lt 10 ] && sleep 3
done
