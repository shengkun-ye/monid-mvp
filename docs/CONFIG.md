# Configuring API keys

**Backend (Edge Functions):** InsForge injects its own credentials (`INSFORGE_BASE_URL`, `ANON_KEY`); you only add the **Apify** token as a secret. **Client (frontend/scripts):** only needs InsForge base URL + anon key when it calls the API.

---

## 1. InsForge (backend)

InsForge base URL and anon key are **already provided** to your Edge Functions at runtime (injected by the platform). You don't store them in secrets. You only need them in *your* config when a **client** (frontend, script) calls the API — get them from the dashboard and put them in that client's .env or deployment env.

| What | Where to get it |
|------|------------------|
| **Base URL** | InsForge dashboard → your project → **Settings** or **API**. Looks like `https://xxxx.us-east.insforge.app`. |
| **Anon key** | Same place in the dashboard (project **Settings** / **API**). Or generate via InsForge API: [Generate anonymous token](https://docs.insforge.dev/api-reference/admin/generate-anonymous-token) (requires admin API key). |

- **Configure in InsForge:** You don’t “create” these in the UI — they belong to your InsForge project. Open [InsForge Dashboard](https://insforge.dev/dashboard), select your project, and find **Base URL** and **Anon key** (or “Anonymous key”) in project settings / API section.
- For **local dev or a frontend app**, put them in a `.env` file (see below). Never commit the real `.env`; use `.env.example` as a template.

---

## 2. Apify (Actor runs)

Used for: starting runs and fetching results/cost. **Store the Apify token on InsForge’s side**, not in your app or .env.

InsForge supports **secrets** for Edge Functions: secrets are encrypted, injected at runtime, and only available inside the function. So the Apify token should live in InsForge as a secret.

| Option | How |
|--------|-----|
| **A) InsForge secret (recommended)** | Create a secret in InsForge with key `APIFY_TOKEN` and value = your Apify API token. The Edge Functions read it via `Deno.env.get('APIFY_TOKEN')`. No token on the client or in your repo. See [InsForge: Create a new secret](https://docs.insforge.dev/api-reference/admin/create-a-new-secret). You can use the **Dashboard** ([insforge.dev/dashboard](https://insforge.dev/dashboard)) → your project → **Secrets** (or **Settings**), or the Admin API `POST /api/secrets` with `key: "APIFY_TOKEN"`, `value: "<your token>"`. |
| **B) Per request (override)** | Client can still send `X-Apify-Token` (or `Authorization: Bearer <token>`) on a request; the function uses that if present, otherwise falls back to the InsForge secret. Useful for per-user or per-client Apify accounts later. |

**Where to get the Apify token (to store in InsForge):**

1. Sign in at [Apify Console](https://console.apify.com).
2. Go to **Settings** → **Integrations** (or [direct link](https://console.apify.com/account/integrations)).
3. Copy your **API token**, then add it in InsForge as the `APIFY_TOKEN` secret (see Option A).

---

## 3. Local / frontend: `.env`

Create a `.env` in the project root only when you run a **frontend or script** that calls your InsForge API (e.g. Phase 5 UI). **Do not commit `.env`** (add it to `.gitignore`).

```bash
# InsForge (from InsForge dashboard → project → Settings/API) – only if your app calls the API
INSFORGE_BASE_URL=https://your-project.us-east.insforge.app
INSFORGE_ANON_KEY=your-anon-key-here
```

- **Apify token** is not needed in .env: it is stored in **InsForge** as a secret (`APIFY_TOKEN`) and used by the Edge Functions. The client does not send it unless you want to override per request (Option B in section 2).

---

## 4. Deployment and portability (easy transfer)

**Idea:** Use **the same variable names** everywhere. Code only reads `process.env.INSFORGE_BASE_URL` etc. How you fill those values depends on the environment.

| Environment | Where to paste / set the keys |
|-------------|-------------------------------|
| **Local dev** | A **`.env`** file in the project root (see section 3). `.env` is in `.gitignore` — never commit it. |
| **Deployed app** (e.g. InsForge hosting, Vercel, Netlify) | The **hosting platform's "Environment variables"** for the frontend: `INSFORGE_BASE_URL`, `INSFORGE_ANON_KEY`. **APIFY_TOKEN** stays in InsForge secrets (backend only); the frontend never needs it. No `.env` file is deployed. |
| **Transfer to another machine / team** | Give them: (1) the **repo** (code), (2) **this doc**. They create their own InsForge project, add the `APIFY_TOKEN` secret in InsForge, and set InsForge base URL + anon key in their frontend env if they have one. No need to copy a real `.env` file. |

**Checklist for "easy transfer":**

1. **In the repo (committed):** Code that reads only env vars (no hardcoded keys). A **template** of required vars (below). `.gitignore` including `.env` so secrets are never committed.
2. **Template of required vars** (copy when setting up a new environment):
   - **InsForge secrets** (Dashboard → project → Secrets): `APIFY_TOKEN` = your Apify API token (so Edge Functions can call Apify; no client config).
   - **Frontend .env or platform env** (only if you have an app that calls the API): `INSFORGE_BASE_URL`, `INSFORGE_ANON_KEY`.

3. **When deploying the app:** Use the platform's UI/CLI to set the same variable names; the build reads them at runtime.

So: **`.env` for local only**; **platform env vars for deployed app**; **repo + this checklist** for transfer. No secrets in the repo.
