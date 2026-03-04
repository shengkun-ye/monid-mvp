# Monid MVP — Engineering Design

**Product:** Help AI agents discover and pay for data.

**Last updated:** 2025-02-21

---

## 1. Overview

- **InsForge:** Database (tasks, optional run history), Auth, Edge Functions (orchestration + client API), AI (planning + translation-code generation). We use the **InsForge AI API** (chat completions); we build the planning and mapping logic on top of it.
- **Apify:** Execution layer. Backend calls **Apify REST API** (not MCP in-process). We wrap the same “discover + run Actors” idea via server-side REST for a simple, reliable MVP.
- **Actor discovery:** Our own layer with a **curated short list** of Apify Actors (no dynamic “search all 5000” in MVP).
- **Deliverables:** Client-facing API endpoints + chat-style UI to demo the API.

**Flow in one sentence:** User/agent sends natural-language request (+ optional output schema) → InsForge AI picks Actor + input → we run Actor via Apify API → we translate raw output to user schema using **AI-generated code** (saved and reused) → we return structured data + cost.

---

## 2. Product Goals (Must-Have)

| Goal | Design |
|------|--------|
| **1. Natural language → structured output** | Request: `request` (string), optional `outputSchema` (e.g. `{ "name": "string", "rating": "number", "address": "string" }`). InsForge AI: (a) choose Actor + input from `request` using curated Actor list, (b) after run, **AI writes translation code** from Actor output → `outputSchema`. We execute that code and return JSON (and optionally table-ready output). Schema adherence is best-effort. |
| **2. Reusable task memory** | Table `tasks`: `id`, `name`, `actor_id`, `actor_input`, `output_schema`, **`translation_code`** (the generated mapper code), `created_at`, `updated_at`. First run can create a task; **translation code is saved**. Future runs by `taskId`: load task, run Actor, **execute saved `translation_code`** (no AI for mapping). Reduces latency and avoids repeated AI planning/code generation. |
| **3. Cost per request** | Every response includes `cost: { providerUsd, currency, unavailable? }`. Apify run details (`GET .../actor-runs/{runId}`) provide `usageTotalUsd` when authenticated. If unavailable: `providerUsd: null`, `unavailable: true`. |

---

## 3. Apify Integration

- **Not** running Apify MCP inside our backend. We use **Apify REST API** (or `apify-client`): start run, poll for completion, get dataset items and run details for cost.
- **Token:** Apify API token required. Store it on **InsForge’s side** as a secret (`APIFY_TOKEN`). Edge Functions read it via `Deno.env.get('APIFY_TOKEN')`; no client config. Optional: client can send `X-Apify-Token` to override per request.

---

## 4. Edge Function Timeout and Async Run Pattern

- InsForge Edge Functions have a **~30 second** timeout per invocation.
- **Implication:** We cannot “wait for Apify run to finish” in one synchronous request (Actor runs can take minutes).

**Async pattern:**

| Step | Behavior |
|------|----------|
| **Start run** | One Edge Function: LLM planning → start Apify run (do not wait) → store `runId` (and optional `taskId`) in DB → return `{ runId, status: "running", message: "Poll GET /runs/:runId for result" }`. Must complete in &lt; 30s. |
| **Get result** | Client polls e.g. `GET /runs/:runId`. Function: check Apify run status; if still running → `{ status: "running" }`; if finished → fetch dataset, run saved or newly generated translation code, get cost → return `{ data, cost, status: "completed" }`. Each poll &lt; 30s. |

**Run by task ID:** Same pattern: “start” with `taskId` uses saved `actor_id`/`actor_input`/`translation_code` (no planning AI); “get result” uses saved `translation_code` (no mapping AI).

---

## 5. Data Model (InsForge DB)

### 5.1 Table: `tasks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | Task identifier. |
| `name` | text, optional | Human-readable name. |
| `description` | text, optional | AI-generated one-sentence description of what the task does. |
| `actor_id` | text | Apify Actor ID (e.g. `apify/google-maps-scraper`). |
| `actor_input` | jsonb | Input passed to the Actor. |
| `output_schema` | jsonb | User-defined output schema. |
| `translation_code` | text | AI-generated code that maps raw Actor output → `output_schema`. Saved after first run and reused. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Optional later: `user_id` to scope tasks to auth.

### 5.2 Table: `runs` (optional for MVP)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | |
| `task_id` | uuid, nullable | FK to `tasks` if run was by task. |
| `apify_run_id` | text | Apify run ID. |
| `status` | text | e.g. `running`, `completed`, `failed`. |
| `cost_provider_usd` | numeric, nullable | From Apify when available. |
| `created_at` | timestamptz | |

Useful for UI history and “last run cost”; not required for API to return cost per request.

---

## 6. Translation: AI Writes Code, We Save and Reuse

- **User schema ≠ Actor output schema:** AI generates **code** (e.g. JavaScript) that maps each raw item to the user’s `outputSchema`.
- **First run (new workflow):** After we have raw dataset, we send to AI: (1) sample of Actor output, (2) `outputSchema`. Prompt: produce a single function `(rawItem) => mappedItem` (or equivalent). We **execute** that code on each item, then **save** it in `tasks.translation_code`.
- **Future runs (by task ID):** Load `translation_code` from task; run it on raw items. **No AI call** for mapping.
- **Execution:** Run saved code in Edge Function (e.g. `new Function('rawItem', 'return ' + code)(item)` or a small sandbox). **Restrict** what the AI can generate (no arbitrary I/O, no require, etc.).
- **Fallback:** If saved code throws (e.g. Actor output shape changed), return clear error; optionally support “regenerate mapper” (one-time AI, then overwrite `translation_code`).

---

## 7. Client-Facing API (InsForge Edge Functions)

InsForge gives one endpoint per function. We use multiple functions or one dispatcher.

### 7.1 POST — Start run

- **Body:** `{ request: string, outputSchema?: Record<string, string>, saveAsTask?: boolean, taskName?: string }`
- **Headers:** `X-Apify-Token` (or agreed auth) for Apify.
- **Behavior:** AI planning (curated Actor list) → start Apify run → store `runId` (and create task if `saveAsTask`) → return `{ runId, status: "running", taskId?: string }`.

### 7.2 GET — Get run result

- **Path:** e.g. `/runs/:runId` (or query param).
- **Behavior:** If run still running → `{ status: "running" }`. If finished → fetch dataset, run translation (saved code for task runs, or generate + save if first run and task was saved), get cost from Apify → return `{ data, cost, status: "completed" }`.

### 7.3 POST — Run by task ID

- **Body:** `{ taskId: string, inputOverrides?: Record<string, unknown> }`
- **Behavior:** Load task (actor_id, actor_input, output_schema, translation_code). Merge `inputOverrides` into `actor_input`. Start Apify run → return `runId`; client polls same “get result” endpoint with this `runId` (and we associate run with task so we use saved `translation_code` when building result).

### 7.4 Optional: GET list tasks, GET task by id

- For UI: list saved tasks, get one task’s metadata.

### 7.5 Unified response shape (for completed runs)

```json
{
  "data": [ { "name": "...", "rating": 4.2, "address": "..." } ],
  "cost": {
    "providerUsd": 0.25,
    "currency": "USD",
    "unavailable": false
  },
  "taskId": "uuid-if-saved",
  "status": "completed"
}
```

If cost unknown: `"providerUsd": null`, `"unavailable": true`.

---

## 8. Cost Handling

- **Apify:** From `GET https://api.apify.com/v2/actor-runs/{runId}` (with same token used to run), read `usageTotalUsd`. Include in every completed-run response.
- **Fallback:** No token, or run not finished, or Apify doesn’t return usage → `cost: { providerUsd: null, currency: "USD", unavailable: true }`.
- **AI cost:** InsForge AI usage can be tracked and optionally exposed later (e.g. `cost.aiEstimateUsd`). MVP can expose only Apify `providerUsd` as “provider cost.”

---

## 9. UI (Demo)

- Single web app (e.g. React + Vite) in this repo.
- Chat-style interface: user types natural-language request; optional output schema; “Run” and “Save as task.” Later: “Run task &lt;id&gt;” or task selector.
- Display: response as table and/or JSON; always show `cost` (and “Cost unavailable” when applicable).
- Auth: Optional for MVP (no auth for demo, or InsForge Auth for “my tasks”).

---

## 10. Constraints and Simplifications

| Item | Choice / constraint |
|------|----------------------|
| **Apify token** | Stored in InsForge secrets (`APIFY_TOKEN`); optional client override via `X-Apify-Token`. |
| **Long runs** | Async: start run → poll for result. No synchronous wait for Actor completion. |
| **Schema** | Best-effort mapping via generated code; no strict JSON Schema validation guarantee. |
| **Actor set** | Curated list of well-known Actors in MVP; no full Apify Store search. |
| **InsForge** | ~30s timeout per Edge Function → async run pattern required. |
| **Generated code** | Execute in controlled way; restrict capabilities (no arbitrary I/O). |

---

## 11. Out of Scope for MVP

- Apify MCP server running inside our backend (we use REST).
- Full Apify Store search (curated Actors only).
- Synchronous “run and wait” in one request.
- Strict schema validation of output.
- Our own billing (only Apify provider cost in response).

---

## 12. Implementation Order (Phasing)

**Suggested phases:**

| Phase | What you build | Demo / check |
|-------|----------------|---------------|
| **1. Foundation** | DB tables (`tasks`, optional `runs`). One Edge Function: “start run” with a fixed Actor + input (e.g. hello-world or fixed Google Maps query). Second function: “get result” by runId (fetch Apify dataset, return raw + cost). No AI, no schema. | Start run → poll → get raw data + cost. |
| **2. AI planning** | Curated Actor list (in code or DB). In “start run,” use InsForge AI to pick `actor_id` + `actor_input` from `request`. Still return raw dataset (no schema mapping). | Natural-language request → correct Actor runs → raw output. |
| **3. Translation** | In “get result”: if `outputSchema` (and optionally task) is present, call AI to generate mapper code from a sample of raw data; execute it; return mapped data. Don’t persist code yet. | Request + schema → mapped output. |
| **4. Save & reuse** | When “start run” is called with `saveAsTask`, create a task row. When generating translation code, save it in `tasks.translation_code`. “Run by task ID” path: load task, use saved `actor_id`/`actor_input`/`translation_code`; no planning AI, no mapping AI on replay. | Save task → run by taskId → same result, no re-planning. |
| **5. UI** | Chat page: send request (+ schema), “Run” and “Save as task,” then “Run task” and display table/JSON + cost. | Full demo for stakeholders. |

**Checklist (same order):**

1. **DB:** Create `tasks` (and optionally `runs`). Add `translation_code` to tasks.
2. **Edge Functions:** Implement “start run” (hardcoded Actor first, no AI). Implement “get result” (fetch dataset, no translation yet). Return cost from Apify where available.
3. **AI planning:** Add curated Actor list; use InsForge AI to derive `actor_id` + `actor_input` from `request`.
4. **Translation:** AI generates mapper code from sample + `outputSchema`; execute and save in `translation_code`; reuse on “get result” when task exists.
5. **Tasks:** `saveAsTask` on first run; “run by task ID” using saved task and saved `translation_code`.
6. **UI:** Chat page calling API; show table/JSON and cost; support “save as task” and “run task.”

---

*This design reflects the decisions discussed: InsForge AI as the engine with our own planning/mapping logic, Apify REST (not MCP in-process), curated Actor list, async run pattern for 30s timeout, and saving/reusing AI-generated translation code for user-defined schemas.*
