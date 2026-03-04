/**
 * Phase 1–4: Get result of an Apify run by our internal runId.
 * GET with runId in query, or POST body: { runId, outputSchema? }.
 * If run has task_id: use saved translation_code when present; else generate and persist to task (Phase 4).
 * Returns: { status: "running" } or { data, cost, status: "completed", taskId? } or { status: "failed", error }.
 */
import { createClient } from "npm:@insforge/sdk";

const TRANSLATION_MODEL = "anthropic/claude-opus-4.5";

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

/** Extract a single JS expression from LLM response (may be in markdown/code block). */
function parseMapperCode(text) {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1].trim() : trimmed;
  const oneLiner = raw.replace(/\n/g, " ").trim();
  return oneLiner || null;
}

/** Run saved mapper code on each item. Returns { mapped, error }. */
function runSavedMapper(code, allItems) {
  try {
    const fn = new Function("rawItem", `return (${code});`);
    const mapped = [];
    for (let i = 0; i < allItems.length; i++) {
      try {
        mapped.push(fn(allItems[i]));
      } catch (e) {
        return {
          mapped: null,
          error: `Saved mapper threw on item ${i}: ${e?.message || String(e)}`,
        };
      }
    }
    return { mapped, error: null };
  } catch (e) {
    return { mapped: null, error: `Saved mapper invalid: ${e?.message || String(e)}` };
  }
}

/** Generate mapper via AI and run on each item. Returns { mapped, error, code? } (code for persisting). */
async function generateAndRunMapper(client, rawSample, outputSchema, allItems) {
  const prompt = `You are a data mapper. Given a sample of raw API output and a target output schema, produce a single JavaScript expression that maps one raw item to the schema.

Raw item sample (one item): ${JSON.stringify(rawSample, null, 2)}

Target output schema (key -> type): ${JSON.stringify(outputSchema, null, 2)}

Rules:
- The expression must use only the variable name "rawItem" for the input object.
- Return ONLY the expression (e.g. ({ name: rawItem.title, rating: rawItem.rating })), no "function", no "return" keyword, no markdown, no code block.
- Coerce types to match schema (string, number, etc.). Use null for missing values.
- Do not use require(), import, or any I/O.`;

  try {
    const completion = await client.ai.chat.completions.create({
      model: TRANSLATION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 1024,
    });
    const content = completion?.choices?.[0]?.message?.content;
    const code = content ? parseMapperCode(content) : null;
    if (!code) return { mapped: null, error: "AI did not return valid mapper expression", code: null };

    const fn = new Function("rawItem", `return (${code});`);
    const mapped = [];
    for (let i = 0; i < allItems.length; i++) {
      try {
        mapped.push(fn(allItems[i]));
      } catch (e) {
        return {
          mapped: null,
          error: `Mapper threw on item ${i}: ${e?.message || String(e)}`,
          code: null,
        };
      }
    }
    return { mapped, error: null, code };
  } catch (e) {
    return {
      mapped: null,
      error: `Mapper generation failed: ${e?.message || String(e)}`,
      code: null,
    };
  }
}

export default async function (req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let runId = null;
  let bodyOutputSchema = null;
  if (req.method === "GET") {
    const url = new URL(req.url);
    runId = url.searchParams.get("runId") || url.pathname.split("/").filter(Boolean).pop();
  } else {
    try {
      const body = await req.json();
      runId = body?.runId;
      bodyOutputSchema =
        body?.outputSchema && typeof body.outputSchema === "object" ? body.outputSchema : null;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
  }

  if (!runId) {
    return jsonResponse({ error: "Missing runId (query param or body)" }, 400);
  }

  // Use only X-Apify-Token or InsForge secret — never Authorization (that's the InsForge anon key).
  const apifyToken = req.headers.get("X-Apify-Token") || Deno.env.get("APIFY_TOKEN");

  const client = createClient({
    baseUrl: Deno.env.get("INSFORGE_BASE_URL"),
    anonKey: Deno.env.get("ANON_KEY"),
  });

  const { data: runRow, error: fetchError } = await client.database
    .from("runs")
    .select("apify_run_id, task_id, output_schema")
    .eq("id", runId)
    .single();

  if (fetchError || !runRow) {
    return jsonResponse({ error: "Run not found", runId }, 404);
  }

  let taskRow = null;
  if (runRow.task_id) {
    const { data: t } = await client.database
      .from("tasks")
      .select("id, translation_code, output_schema, description")
      .eq("id", runRow.task_id)
      .single();
    taskRow = t ?? null;
  }

  const apifyRunId = runRow.apify_run_id;

  try {
    const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${apifyRunId}`, {
      headers: apifyToken ? { Authorization: `Bearer ${apifyToken}` } : {},
    });

    if (!runRes.ok) {
      return jsonResponse(
        { error: "Failed to fetch run from Apify", status: runRes.status },
        502
      );
    }

    const runData = await runRes.json();
    const status = runData.data?.status;
    const defaultDatasetId = runData.data?.defaultDatasetId;
    const usageTotalUsd = runData.data?.usageTotalUsd ?? null;

    if (status === "RUNNING" || status === "READY") {
      return jsonResponse({
        status: "running",
        message: "Run not finished. Poll again later.",
      });
    }

    if (status === "FAILED" || status === "ABORTED") {
      await client.database.from("runs").update({ status: "failed" }).eq("id", runId);
      return jsonResponse({
        status: "failed",
        error: runData.data?.statusMessage || status,
      });
    }

    if (status !== "SUCCEEDED") {
      return jsonResponse({
        status: "unknown",
        error: `Unexpected Apify status: ${status}`,
      });
    }

    let items = [];
    if (defaultDatasetId) {
      const datasetRes = await fetch(
        `https://api.apify.com/v2/datasets/${defaultDatasetId}/items`,
        {
          headers: apifyToken ? { Authorization: `Bearer ${apifyToken}` } : {},
        }
      );
      if (datasetRes.ok) {
        items = await datasetRes.json();
      }
    }

    await client.database
      .from("runs")
      .update({
        status: "completed",
        cost_provider_usd: usageTotalUsd != null ? Number(usageTotalUsd) : null,
      })
      .eq("id", runId);

    const cost = {
      providerUsd: usageTotalUsd != null ? Number(usageTotalUsd) : null,
      currency: "USD",
      unavailable: usageTotalUsd == null,
    };

    const outputSchema =
      bodyOutputSchema ?? runRow.output_schema ?? (taskRow?.output_schema ?? null);
    let dataToReturn = items;
    let responseTaskId = runRow.task_id ?? undefined;
    const taskDescription = taskRow?.description ?? null;

    if (outputSchema && items.length > 0) {
      const savedCode = taskRow?.translation_code ?? null;
      if (savedCode) {
        const { mapped, error: runError } = runSavedMapper(savedCode, items);
        if (runError) {
          return jsonResponse({
            status: "completed",
            data: items,
            cost,
            ...(responseTaskId && { taskId: responseTaskId, taskDescription }),
            translationError: runError,
            message: "Returning raw data; saved mapper failed.",
          });
        }
        dataToReturn = mapped;
      } else {
        const sample = items[0];
        const { mapped, error: mapError, code: generatedCode } = await generateAndRunMapper(
          client,
          sample,
          outputSchema,
          items
        );
        if (mapError) {
          return jsonResponse({
            status: "completed",
            data: items,
            cost,
            ...(responseTaskId && { taskId: responseTaskId, taskDescription }),
            translationError: mapError,
            message: "Returning raw data; mapping failed.",
          });
        }
        dataToReturn = mapped;
        if (runRow.task_id && generatedCode) {
          await client.database
            .from("tasks")
            .update({
              translation_code: generatedCode,
              updated_at: new Date().toISOString(),
            })
            .eq("id", runRow.task_id);
        }
      }
    }

    return jsonResponse({
      data: dataToReturn,
      cost,
      status: "completed",
      ...(responseTaskId && { taskId: responseTaskId, taskDescription }),
    });
  } catch (e) {
    return jsonResponse(
      { error: "Get result failed", details: e?.message },
      500
    );
  }
}
