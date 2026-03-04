## Apify LinkedIn actors used in Monid

This document summarizes the key LinkedIn-related Apify actors we use so AI (and humans) can generate correct inputs and reason about behavior without re-reading the full Apify docs every time.

For full reference, see the Apify pages:

- `harvestapi/linkedin-profile-search`: https://apify.com/harvestapi/linkedin-profile-search
- `powerai/linkedin-job-search-scraper`: https://apify.com/powerai/linkedin-job-search-scraper
- `powerai/linkedin-company-search-scraper`: https://apify.com/powerai/linkedin-company-search-scraper

We also fetched the OpenAPI / README content into the repo for tooling:

- HarvestAPI profile search notes: `agent-tools/6263519b-6b94-4bfa-adda-1ecc51d1e2cc.txt`
- PowerAI job search notes: `agent-tools/1cc92de2-a934-4918-8351-00f81cd447cd.txt`
- PowerAI company search notes: `agent-tools/76eec0d1-f9f9-4a80-8dbb-fc235dfc603d.txt`

### `harvestapi/linkedin-profile-search`

High level:

- Mass LinkedIn **profile search** with rich filters (titles, locations, companies, schools, industries, experience, etc.).
- No cookies or LinkedIn account required.
- Supports “short” vs “full” vs “full + email search” modes.

Important input fields (non-exhaustive):

- `searchQuery`: general fuzzy search (e.g. `"Marketing Manager"`, `"Founder"`, `"John Doe"`).
- Filters are lists: current/past job titles, locations, company URLs, school URLs, industry IDs, experience years, years at company.
- Pagination / limits: `startPage`, `takePages`, `maxItems`.

In our `CURATED_ACTORS` example we keep it simple:

- We mainly pass a `search`-style field and `maxItems`; advanced filters can be added later if needed.

### `powerai/linkedin-job-search-scraper`

High level:

- Searches **job listings** on LinkedIn.
- Returns detailed job metadata (title, company, salary info, requirements, etc.).

Key input fields:

- `query` (required): keyword(s) for the job search.
- `maxResults` (required): max jobs to fetch.
- Optional filters like `experience`, `jobType`, `postedAgo`, etc.

In our `CURATED_ACTORS` example:

- We map the user’s natural-language request into `keywords` / `query` plus `maxItems`/`maxResults`.

### `powerai/linkedin-company-search-scraper`

High level:

- Searches **companies** on LinkedIn.
- Returns company metadata (name, staff count, industry, URLs, etc.).

Key input fields:

- `keyword` (required): search keyword for company search.
- `maxResults` (required): max companies to fetch.
- `hasJobs` (optional): filter companies that currently have job postings.

In our `CURATED_ACTORS` example:

- We mostly need a single `search`/`keyword` field plus a limit (`maxItems` / `maxResults`).

