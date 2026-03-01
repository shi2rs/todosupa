import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, getUser, isAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the caller
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = await isAdmin(user.id);
  const db = adminClient();
  const url = new URL(req.url);

  try {
    // ── GET /todos ────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      let query = db.from("todos").select("*").order("created_at", { ascending: false });

      // Admins see all; regular users see only their own
      if (!admin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST /todos ───────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const { text } = await req.json();
      if (!text?.trim()) {
        return new Response(JSON.stringify({ error: "text is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await db
        .from("todos")
        .insert({ user_id: user.id, text: text.trim() })
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PATCH /todos/:id ──────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const id = url.pathname.split("/").pop();
      if (!id) {
        return new Response(JSON.stringify({ error: "Todo ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if (body.text !== undefined) updates.text = body.text.trim();
      if (body.completed !== undefined) updates.completed = body.completed;

      // Build query — admins can update any todo, users only their own
      let query = db.from("todos").update(updates).eq("id", id);
      if (!admin) query = query.eq("user_id", user.id);

      const { data, error } = await query.select().single();
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE /todos/:id ─────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const id = url.pathname.split("/").pop();
      if (!id) {
        return new Response(JSON.stringify({ error: "Todo ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Admins can delete any todo, users only their own
      let query = db.from("todos").delete().eq("id", id);
      if (!admin) query = query.eq("user_id", user.id);

      const { error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
