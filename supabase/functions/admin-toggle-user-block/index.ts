// Supabase Edge Function: admin-toggle-user-block
//
// Blocks or unblocks a user at BOTH levels:
//   1. Supabase Auth level (ban_duration) — immediately invalidates
//      the user's JWT and prevents new logins.
//   2. profiles.is_active — for display in the admin panel.
//
// Why both: profiles.is_active alone only affects UI display.
// Auth-level ban actually prevents the user from using the platform.
//
// Called by admin.tsx toggleUserBlock() via supabase.functions.invoke().
// Admin-only: verifies caller's JWT and checks is_admin in profiles.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify caller is authenticated.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // 2. Verify caller is admin.
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Not authorized." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // 3. Parse request body.
    const { user_id, block } = await req.json();
    // block = true  → block the user (ban + is_active = false)
    // block = false → unblock the user (unban + is_active = true)

    if (!user_id || typeof block !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Missing user_id or block (boolean)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Safety: never block another admin.
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user_id)
      .single();

    if (targetProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Cannot block an admin account." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 4. Auth-level ban/unban.
    //    ban_duration "876000h" ≈ 100 years (effectively permanent).
    //    ban_duration "none" removes the ban.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { ban_duration: block ? "876000h" : "none" }
    );

    if (banError) {
      console.error("admin-toggle-user-block auth ban error:", banError);
      return new Response(
        JSON.stringify({ error: `Auth ban failed: ${banError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 5. Update profiles.is_active for admin panel display.
    //    Even if this fails, the Auth-level ban (step 4) is already in
    //    effect — the user cannot log in. Log but don't fail the request.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: !block })
      .eq("id", user_id);

    if (profileError) {
      console.error("admin-toggle-user-block profile update error:", profileError);
      // Auth ban succeeded; profile display is stale but user is blocked.
      // Return success with a warning rather than failing.
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Auth ban applied but profile display may be stale.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("admin-toggle-user-block error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
