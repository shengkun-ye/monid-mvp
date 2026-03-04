#!/usr/bin/env bash
# Run by task ID (Phase 4). Loads key and URL from .env.
# Usage: bash scripts/run-task.sh <taskId> [inputOverridesJson]
# Example: bash scripts/run-task.sh "550e8400-e29b-41d4-a716-446655440000"
# Example: bash scripts/run-task.sh "550e8400-e29b-41d4-a716-446655440000" '{"maxCrawledPlacesPerSearch":5}'
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

TASK_ID="${1:?Usage: bash scripts/run-task.sh <taskId> [inputOverridesJson]}"
INPUT_OVERRIDES="${2:-}"

if [ -n "$INPUT_OVERRIDES" ]; then
  BODY=$(printf '{"taskId":"%s","inputOverrides":%s}' "$TASK_ID" "$INPUT_OVERRIDES")
else
  BODY=$(printf '{"taskId":"%s"}' "$TASK_ID")
fi

echo "Starting run by task (taskId=$TASK_ID)..."
RES=$(curl -s -X POST "$BASE_URL/functions/start-run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "$BODY")
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
