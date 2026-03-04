# Monid MVP

Help AI agents discover and pay for data. Wraps Apify as the execution layer with InsForge backend.

See [docs/ENGINEERING_DESIGN.md](docs/ENGINEERING_DESIGN.md) for full design.

---

## Phase 1 – Foundation ✓ | Phase 2 – AI planning ✓ | Phase 3 – Translation ✓ | Phase 4 – Save & reuse ✓

- **DB:** `tasks`, `runs` tables in InsForge. `runs.output_schema` stores optional schema; `tasks.translation_code` stores the AI-generated mapper (Phase 4).
- **API:** Edge Functions:
  - **start-run** – Start an Apify Actor run. **By request:** `{ request?, outputSchema?, saveAsTask?, taskName? }` — AI picks Actor + input; if `saveAsTask` creates a task and returns `taskId`. **By task:** `{ taskId, inputOverrides? }` — runs saved task (no AI). Returns `runId` for polling.
  - **get-result** – Poll by `runId`. When run is linked to a task: uses saved `translation_code` when present; on first run generates mapper and saves it to the task. Returns `data`, `cost`, optional `taskId`.
  - **tasks** – GET list tasks or GET one by `?id=<taskId>` (metadata only, no translation code).
- **Curated Actors (Phase 2):** hello-world (test), Google Maps Scraper (places/cafes), Web Scraper (URLs). See `functions/start-run.js` (CURATED_ACTORS).

### How to call the API

You need:

1. **InsForge base URL and anon key** – From [InsForge Dashboard](https://insforge.dev/dashboard) → your project → Settings/API (only if you call the API from a frontend or script).
2. **Apify token on InsForge** – Store your [Apify API token](https://console.apify.com/account/integrations) as a secret in InsForge (Dashboard → project → Secrets, key `APIFY_TOKEN`). The Edge Functions read it from there; you don’t send it from the client.

**→ Full steps:** [docs/CONFIG.md](docs/CONFIG.md)

**Start a run (POST):**  
- **By request:** `request` (natural language), optional `outputSchema`, optional `saveAsTask` (creates a task and returns `taskId`), optional `taskName`. Omit body or empty `request` for fixed hello-world.
- **By task (Phase 4):** `{ "taskId": "<uuid>", "inputOverrides": { ... } }` — runs the saved task; no AI. Poll get-result with the returned `runId` (uses saved translation code).

```bash
# With request + schema + save as task
curl -X POST "https://YOUR_INSFORGE_BASE_URL/functions/start-run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"request": "top 10 cafes in Boston", "outputSchema": {"name": "string", "rating": "number", "address": "string"}, "saveAsTask": true, "taskName": "Boston cafes"}'

# Run by task ID (no AI)
curl -X POST "https://YOUR_INSFORGE_BASE_URL/functions/start-run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"taskId": "<taskId>", "inputOverrides": {"maxCrawledPlacesPerSearch": 5}}'
```
If `APIFY_TOKEN` is set in InsForge secrets, no Apify header needed.

Response: `{ "runId": "<uuid>", "status": "running", "taskId": "<uuid>"? }`

**Get result (POST with runId):**

```bash
curl -X POST "https://YOUR_INSFORGE_BASE_URL/functions/get-result" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"runId": "<runId from start-run>"}'
```
(Again, no Apify header if `APIFY_TOKEN` is in InsForge secrets.)

- If still running: `{ "status": "running", "message": "..." }`
- If completed: `{ "data": [...], "cost": {...}, "status": "completed", "taskId"? }` — when the run had `outputSchema` (or is linked to a task with schema), `data` is **mapped**; task runs use saved `translation_code` (Phase 4). If mapping failed, response includes raw `data` and `translationError`.

**Using InsForge SDK:**

```js
import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://YOUR_INSFORGE_BASE_URL',
  anonKey: 'YOUR_ANON_KEY',
});

// Start run (no Apify header if APIFY_TOKEN is set in InsForge secrets)
const { data: start } = await client.functions.invoke('start-run', { method: 'POST' });
const runId = start.runId;

// Poll for result
const { data: result } = await client.functions.invoke('get-result', {
  method: 'POST',
  body: { runId },
});
console.log(result.status, result.data, result.cost);
```

### How to test (Phase 1)

**Option A – use `.env` and run the script (no copy-paste):**

In project root, create `.env` with your InsForge key and URL:
```bash
INSFORGE_KEY=your-anon-key
INSFORGE_URL=https://your-project.us-east.insforge.app
```
(Use `INSFORGE_KEY` / `INSFORGE_URL`; these are what the scripts and UI expect.)

Then run:
```bash
bash scripts/test-phase1.sh
```
To test with a natural-language request: `bash scripts/test-phase1.sh "top 10 cafes in Boston"`  
To test Phase 3 translation (request + outputSchema): `bash scripts/test-phase1.sh "top 5 cafes in Boston" with-schema`

The script loads `.env`, calls start-run, then polls get-result until completed.

**Option B – manual curl:**

1. **Get from InsForge Dashboard** ([insforge.dev/dashboard](https://insforge.dev/dashboard) → your project → Settings/API):
   - **Base URL** (e.g. `https://xxxx.us-east.insforge.app`)
   - **Anon key** (needed as Bearer token to invoke functions)

2. **Start a run** (replace `BASE_URL` and `ANON_KEY`). Use `/functions/` not `/api/functions/`:

   ```bash
   curl -X POST "https://BASE_URL/functions/start-run" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ANON_KEY"
   ```

   You should get something like: `{"runId":"<uuid>","status":"running","message":"..."}`. Copy the `runId`.

3. **Poll for result** (replace `BASE_URL`, `ANON_KEY`, and `RUN_ID`):

   ```bash
   curl -X POST "https://BASE_URL/functions/get-result" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ANON_KEY" \
     -d '{"runId":"RUN_ID"}'
   ```

   - If you see `"status":"running"`, wait a few seconds and run the same command again.
   - When done you should see `"status":"completed"` with `data` (array) and `cost` (e.g. `providerUsd`, `unavailable`).

4. **If you get 401:** Check that the anon key is correct and passed as `Authorization: Bearer <anon_key>`.
5. **If start-run says "Missing Apify token":** Add your Apify API token in InsForge Dashboard → project → **Secrets** with key `APIFY_TOKEN`.

### Deploy the app (Streamlit Community Cloud)

1. Push this repo to GitHub.
2. Go to [share.streamlit.io](https://share.streamlit.io), sign in with GitHub, and click **New app**.
3. Set **Repository** to your repo, **Branch** to `main` (or your default), **Main file path** to `app.py`.
4. In **Advanced settings** → **Secrets**, add your InsForge credentials (same as in `.env` locally):

   ```toml
   INSFORGE_URL = "https://your-project.us-east.insforge.app"
   INSFORGE_KEY = "your-anon-key"
   ```

5. Deploy. The app will run at `https://<your-app-name>.streamlit.app`.

Requirements: `requirements.txt` (Streamlit installs it automatically). Do not commit `.env`; use Streamlit Secrets in the cloud.

### Project layout

- `app.py` – Streamlit UI (search, tasks, run/save).
- `functions/` – Edge Function source (start-run.js, get-result.js, tasks.js).
- `docs/ENGINEERING_DESIGN.md` – Engineering design and implementation order.

**List/get tasks (GET):**  
`GET /functions/tasks` — list all tasks. `GET /functions/tasks?id=<taskId>` — get one task (metadata only).

Next: **Phase 5** – UI (chat page, Run / Save as task / Run task, table/JSON + cost).
