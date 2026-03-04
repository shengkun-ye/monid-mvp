/**
 * Phase 4: List tasks or get one task by id.
 * GET with optional query id=<uuid>. If id present returns single task (metadata only, no translation_code); else returns list of tasks.
 */
import { createClient } from "npm:@insforge/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const taskId = url.searchParams.get("id") || null;

  const client = createClient({
    baseUrl: Deno.env.get("INSFORGE_BASE_URL"),
    anonKey: Deno.env.get("ANON_KEY"),
  });

  if (taskId) {
    const { data: task, error } = await client.database
      .from("tasks")
      .select("id, name, description, actor_id, actor_input, output_schema, created_at, updated_at")
      .eq("id", taskId)
      .single();
    if (error || !task) return jsonResponse({ error: "Task not found", taskId }, 404);
    return jsonResponse(task);
  }

  const { data: tasks, error } = await client.database
    .from("tasks")
    .select("id, name, description, actor_id, output_schema, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) return jsonResponse({ error: "Failed to list tasks", details: error.message }, 500);
  return jsonResponse({ tasks: tasks ?? [] });
}
