/**
 * Phase 2–4: Start an Apify Actor run.
 * POST body:
 * - Run by request: { request?, outputSchema?, saveAsTask?, taskName? }. AI plans Actor + input; optional saveAsTask creates a task and links run (Phase 4).
 * - Run by task: { taskId, inputOverrides? }. Loads task, merges inputOverrides, starts run; no AI (Phase 4).
 * Returns: { runId, status: "running", taskId?, message }.
 */
import { createClient } from "npm:@insforge/sdk";

// CURATED_ACTORS inlined from curated-actors.js for InsForge single-file deploy. Keep in sync when editing actors.
const CURATED_ACTORS = [
  {
    actorId: "apify~hello-world",
    description: "Simple test actor. Use when the user asks for a test, demo, or hello world.",
    exampleInput: {},
  },
  {
    actorId: "damilo~google-maps-scraper",
    description:
      "Scrape Google Maps: businesses, cafes, restaurants, shops by search query and location. Returns name, address, phone, website, rating, reviews. REQUIRED: query (what to search) and location (where).",
    exampleInput: {
      query: "cafes",
      location: "Boston, MA, USA",
      max_results: 10,
    },
  },
  {
    actorId: "apify~web-scraper",
    description:
      "Scrape arbitrary websites by URL. Use ONLY when no dedicated actor fits. Do NOT use for Twitter/X, Reddit, LinkedIn, Instagram, etc.—use those platform-specific actors instead.",
    exampleInput: {
      startUrls: [{ url: "https://example.com" }],
      pageFunction: "async function pageFunction(context) { return context.page.title(); }",
    },
  },
  {
    actorId: "apidojo~tweet-scraper",
    description:
      "X (Twitter) scraper. Use for ANY Twitter/X request: recent posts from @username, user timeline, tweets from a handle, search by keyword/hashtag. Returns tweets, engagement, author. Input via startUrls and/or handles. See Apify console: https://console.apify.com/actors/61RPP7dywgiy0JPD0/input",
    exampleInput: {
      startUrls: ["https://twitter.com/username"],
      handles: ["username"],
      maxItems: 50,
    },
  },
  {
    actorId: "trudax~reddit-scraper-lite",
    description:
      "Scrape Reddit: posts, comments, subreddits. Search by keyword, subreddit name, or URLs. Returns titles, text, scores, comments. See Apify console: https://console.apify.com/actors/oAuCIx3ItNrs2okjQ/input",
    exampleInput: {
      startUrls: [{ url: "https://www.reddit.com/r/subreddit/" }],
      maxItems: 100,
    },
  },
  {
    actorId: "harvestapi~linkedin-post-search",
    description:
      "Search LinkedIn posts by query. Use for finding posts, discussions, and content on LinkedIn. See Apify console: https://console.apify.com/actors/buIWk2uOUzTmcLsuB/information/latest/readme",
    exampleInput: {
      search: "search query for posts",
      maxItems: 50,
    },
  },
  {
    actorId: "delicious_zebu~amazon-product-details-scraper",
    description:
      "Scrape Amazon product details: pricing, reviews, ratings, availability, descriptions, ASINs from product URLs.",
    exampleInput: {
      startUrls: [{ url: "https://www.amazon.com/dp/ASIN" }],
      maxItems: 10,
    },
  },
  {
    actorId: "scrapeai~amazon-product-scraper",
    description:
      "Scrape Amazon: product info, reviews, prices, descriptions from product or search URLs.",
    exampleInput: {
      startUrls: [{ url: "https://www.amazon.com/dp/ASIN" }],
    },
  },
  {
    actorId: "scrapier~amazon-search-actor",
    description:
      "Scrape Amazon search results: product titles, prices, ratings, images by search query.",
    exampleInput: {
      searchStringsArray: ["laptop"],
      country: "US",
      maxItems: 50,
    },
  },
  {
    actorId: "thescrapelab~tiktok-scraper-2-0",
    description:
      "Scrape TikTok: users, keywords, profiles, video analytics, transcripts. Use handles or search terms.",
    exampleInput: {
      userNames: ["username"],
      maxUserCount: 10,
      maxVideoCount: 20,
    },
  },
  {
    actorId: "apidojo~tiktok-scraper-api",
    description:
      "Scrape TikTok: videos, profiles, hashtags, music, search results. Fast extraction.",
    exampleInput: {
      hashtags: ["trending"],
      maxResults: 50,
    },
  },
  {
    actorId: "neuro-scraper~tiktok-video-details-scraper",
    description:
      "Scrape TikTok video details from video URLs: views, likes, comments, author info.",
    exampleInput: {
      postURLs: ["https://www.tiktok.com/@user/video/123"],
    },
  },
  {
    actorId: "apify~instagram-profile-scraper",
    description:
      "Scrape Instagram: profiles and posts. Returns name, bio, followers, latest posts, engagement. Use profile URLs or usernames.",
    exampleInput: {
      directUrls: ["https://www.instagram.com/username/"],
      resultsLimit: 30,
    },
  },
  {
    actorId: "alizarin_refrigerator-owner~instagram-scraper",
    description:
      "Scrape Instagram profiles and posts without login. Follower counts, engagement, reels.",
    exampleInput: {
      username: ["username"],
      resultsLimit: 20,
    },
  },
  {
    actorId: "data-slayer~instagram-posts",
    description:
      "Scrape Instagram user posts: engagement metrics, content history. No login required.",
    exampleInput: {
      usernames: ["username"],
      maxPosts: 50,
    },
  },
  {
    actorId: "video-scraper~youtube-channel-video-scraper",
    description:
      "Scrape YouTube channel videos: video URLs, titles, thumbnails, view counts, publish dates. Use channel URL or @handle.",
    exampleInput: {
      channelUrl: "https://www.youtube.com/@channel",
      maxResults: 50,
    },
  },
  {
    actorId: "alpha-scraper~youtube-channel-scraper-metadata-extractor",
    description:
      "Scrape YouTube channel metadata: subscribers, total views, description, social links, statistics.",
    exampleInput: {
      channelUrls: ["https://www.youtube.com/@channel"],
    },
  },
  {
    actorId: "scraper-engine~facebook-url-to-id",
    description:
      "Convert Facebook URLs (profiles, pages, groups, posts) to numeric IDs for automation and integrations.",
    exampleInput: {
      startUrls: [{ url: "https://www.facebook.com/page-or-profile" }],
    },
  },
];

const FALLBACK_ACTOR_ID = "apify~hello-world";
const FALLBACK_INPUT = {};
const PLANNING_MODEL = "anthropic/claude-opus-4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Apify-Token",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extract JSON object from LLM response (may be wrapped in markdown or text). */
function parsePlanningResponse(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/** Fetch actor's input schema from Apify API. Returns condensed spec { properties, required } or null. */
async function fetchActorInputSchema(apifyToken, actorId) {
  const actorIdEnc = encodeURIComponent(String(actorId).replace("~", "/"));
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${actorIdEnc}`, {
      headers: { Authorization: `Bearer ${apifyToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const schema = data?.data?.inputSchema ?? data?.inputSchema ?? null;
    if (!schema || typeof schema !== "object") return null;
    return {
      title: schema.title,
      description: schema.description,
      required: Array.isArray(schema.required) ? schema.required : [],
      properties: schema.properties && typeof schema.properties === "object" ? schema.properties : {},
    };
  } catch {
    return null;
  }
}

/** Generate a short human-readable task description using AI. */
async function generateTaskDescription(client, {
  userRequest,
  actorId,
  actorInput,
  outputSchema,
}) {
  const parts = [];
  if (userRequest) parts.push(`User request: ${userRequest}`);
  parts.push(`Actor: ${actorId}`);
  parts.push(`Actor input (example): ${JSON.stringify(actorInput).slice(0, 400)}`);
  if (outputSchema) {
    parts.push(`Output schema: ${JSON.stringify(outputSchema).slice(0, 400)}`);
  }
  const context = parts.join("\n");

  const prompt = `You are documenting a reusable data task.

Context:
${context}

Write a single short title or phrase (2–8 words, max 80 characters) describing what this task does, e.g. "Boston coffee locations".
Do not prefix with "Task:", do not add quotes or punctuation at the ends, and do not use markdown.`;

  try {
    const completion = await client.ai.chat.completions.create({
      model: PLANNING_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 80,
    });
    const raw = completion?.choices?.[0]?.message?.content?.trim() || "";
    // Ensure it's short-ish.
    return raw.length > 200 ? raw.slice(0, 197) + "..." : raw;
  } catch (e) {
    console.error("generateTaskDescription failed:", e?.message);
    return null;
  }
}

export default async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apifyToken = req.headers.get("X-Apify-Token") || Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    return jsonResponse({
      error: "Missing Apify token. Send X-Apify-Token header or set APIFY_TOKEN in InsForge secrets.",
    }, 401);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const client = createClient({
    baseUrl: Deno.env.get("INSFORGE_BASE_URL"),
    anonKey: Deno.env.get("ANON_KEY"),
  });

  // Phase 4: Run by task ID — load task, merge inputOverrides, start Apify run.
  const taskId = body.taskId ?? null;
  if (taskId) {
    const { data: taskRow, error: taskError } = await client.database
      .from("tasks")
      .select("id, actor_id, actor_input, output_schema")
      .eq("id", taskId)
      .single();
    if (taskError || !taskRow) {
      return jsonResponse({ error: "Task not found", taskId }, 404);
    }
    let actorInput = { ...(taskRow.actor_input || {}) };
    if (body.inputOverrides && typeof body.inputOverrides === "object") {
      actorInput = { ...actorInput, ...body.inputOverrides };
    }
    try {
      const taskActorIdEnc = encodeURIComponent(String(taskRow.actor_id).replace("~", "/"));
      const res = await fetch(`https://api.apify.com/v2/acts/${taskActorIdEnc}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apifyToken}`,
        },
        body: JSON.stringify(actorInput),
      });
      if (!res.ok) {
        const text = await res.text();
        let details = text;
        try {
          const parsed = JSON.parse(text);
          details = parsed.error?.message ?? parsed.message ?? parsed;
        } catch {
          //
        }
        return jsonResponse({
          error: "Apify start run failed",
          apifyStatus: res.status,
          details,
          actorId: taskRow.actor_id,
        }, 502);
      }
      const runPayload = await res.json();
      const apifyRunId = runPayload.data?.id;
      if (!apifyRunId) {
        return jsonResponse({ error: "Apify did not return run id" }, 502);
      }
      const { data: runRow, error: insertError } = await client.database
        .from("runs")
        .insert({
          apify_run_id: apifyRunId,
          status: "running",
          task_id: taskId,
          output_schema: taskRow.output_schema,
        })
        .select("id")
        .single();
      if (insertError || !runRow) {
        return jsonResponse({ error: "Failed to store run", details: insertError?.message }, 500);
      }
      return jsonResponse({
        runId: runRow.id,
        status: "running",
        taskId,
        message: "Poll get-result with runId for result.",
      });
    } catch (e) {
      return jsonResponse({ error: "Start run failed", details: e?.message }, 500);
    }
  }

  const userRequest = typeof body.request === "string" ? body.request.trim() : "";
  let actorId = FALLBACK_ACTOR_ID;
  let actorInput = FALLBACK_INPUT;

  if (userRequest) {
    const actorsList = CURATED_ACTORS.map(
      (a) => `- ${a.actorId}: ${a.description}. Example input keys: ${JSON.stringify(a.exampleInput)}`
    ).join("\n");

    const prompt = `You are a planner. The user wants data. Choose ONE Apify Actor and produce the exact input for it.
Rule: For Twitter/X (e.g. "posts from @user", "tweets from handle", "X timeline") always use apidojo~tweet-scraper. Use startUrls as array of URL strings (e.g. ["https://twitter.com/elonmusk"]) and/or handles as array of handles without @.

Available Actors (actorId and example input shape only):
${actorsList}

User request: "${userRequest}"

Respond with ONLY a single JSON object, no other text: {"actorId": "<actorId from list>", "input": <object for that Actor's API>}.
Use the example input shapes; fill in values that match the user request (e.g. search query, location, URLs, handles). Keep "input" valid JSON.`;

    try {
      const completion = await client.ai.chat.completions.create({
        model: PLANNING_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        maxTokens: 1024,
      });
      const content = completion?.choices?.[0]?.message?.content;
      const planned = content ? parsePlanningResponse(content) : null;
      if (planned && planned.actorId) {
        const known = CURATED_ACTORS.find((a) => a.actorId === planned.actorId);
        if (known) {
          actorId = planned.actorId;
          actorInput = planned.input && typeof planned.input === "object" ? planned.input : {};

          // Fetch actor's real input schema from Apify and have LLM produce input from it
          const schema = await fetchActorInputSchema(apifyToken, actorId);
          if (schema && schema.properties && Object.keys(schema.properties).length > 0) {
            const schemaStr = JSON.stringify(schema, null, 2);
            const schemaPrompt = `You produce input for an Apify Actor. The actor's input schema is below. User request: "${userRequest}"

Input schema (required fields: ${(schema.required || []).join(", ") || "none"}):
${schemaStr}

Produce a valid input object that matches this schema and fulfills the user request. Omit optional fields if not needed. For arrays (e.g. startUrls, twitterHandles, searchTerms) use the types shown. Respond with ONLY a JSON object, no other text.`;
            try {
              const schemaCompletion = await client.ai.chat.completions.create({
                model: PLANNING_MODEL,
                messages: [{ role: "user", content: schemaPrompt }],
                temperature: 0.1,
                maxTokens: 1024,
              });
              const schemaContent = schemaCompletion?.choices?.[0]?.message?.content;
              const parsedInput = schemaContent ? parsePlanningResponse(schemaContent) : null;
              if (parsedInput && typeof parsedInput === "object" && !Array.isArray(parsedInput)) {
                actorInput = parsedInput;
              }
            } catch (e) {
              console.error("Schema-based input generation failed, using draft:", e?.message);
            }
          }
        }
      }
    } catch (e) {
      console.error("Planning failed, using fallback:", e?.message);
    }
  }

  try {
    // Apify API accepts actorId as owner~actor-name (tilde) or owner/actor-name (slash). Encode for URL.
    const actorIdEnc = encodeURIComponent(actorId.replace("~", "/"));
    const res = await fetch(`https://api.apify.com/v2/acts/${actorIdEnc}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify(actorInput),
    });

    if (!res.ok) {
      const text = await res.text();
      let details = text;
      try {
        const parsed = JSON.parse(text);
        details = parsed.error?.message ?? parsed.message ?? parsed;
      } catch {
        // keep raw text
      }
      return jsonResponse({
        error: "Apify start run failed",
        apifyStatus: res.status,
        details,
        actorId,
      }, 502);
    }

    const runPayload = await res.json();
    const apifyRunId = runPayload.data?.id;
    if (!apifyRunId) {
      return jsonResponse({ error: "Apify did not return run id", payload: runPayload }, 502);
    }

    const outputSchema =
      body.outputSchema && typeof body.outputSchema === "object" ? body.outputSchema : null;

    let runTaskId = null;
    if (body.saveAsTask) {
      const taskName =
        typeof body.taskName === "string" ? body.taskName.trim() || null : null;
      const taskDescription = await generateTaskDescription(client, {
        userRequest,
        actorId,
        actorInput,
        outputSchema,
      });
      const { data: taskRow, error: taskInsertErr } = await client.database
        .from("tasks")
        .insert({
          name: taskName,
          description: taskDescription,
          actor_id: actorId,
          actor_input: actorInput,
          output_schema: outputSchema,
        })
        .select("id")
        .single();
      if (!taskInsertErr && taskRow) runTaskId = taskRow.id;
    }

    const { data: runRow, error: insertError } = await client.database
      .from("runs")
      .insert({
        apify_run_id: apifyRunId,
        status: "running",
        task_id: runTaskId,
        output_schema: outputSchema,
      })
      .select("id")
      .single();

    if (insertError || !runRow) {
      return jsonResponse({ error: "Failed to store run", details: insertError?.message }, 500);
    }

    return jsonResponse({
      runId: runRow.id,
      status: "running",
      message: "Poll get-result with runId for result.",
      ...(runTaskId && { taskId: runTaskId }),
      ...(userRequest && { planned: { actorId, input: actorInput } }),
    });
  } catch (e) {
    return jsonResponse({ error: "Start run failed", details: e?.message }, 500);
  }
}
