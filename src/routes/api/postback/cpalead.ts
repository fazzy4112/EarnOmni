import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/server-client";

// CPAlead postback hits this endpoint:
// https://earnomni.com/api/postback/cpalead?subid={subid}&lead_id={lead_id}&campaign_id={campaign_id}&campaign_name={campaign_name}&payout={payout}&password=YOUR_SECRET
export const Route = createFileRoute("/api/postback/cpalead")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const subid = url.searchParams.get("subid")?.trim();
        const leadId = url.searchParams.get("lead_id")?.trim();
        const campaignId = url.searchParams.get("campaign_id")?.trim();
        const campaignName = url.searchParams.get("campaign_name")?.trim();
        const payoutRaw = url.searchParams.get("payout");
        const password = url.searchParams.get("password");

        const expectedPassword = process.env.CPALEAD_POSTBACK_SECRET;

        if (!expectedPassword || password !== expectedPassword) {
          return new Response("Unauthorized", { status: 401 });
        }

        if (!subid || !leadId || !payoutRaw) {
          return new Response("Missing required parameters", { status: 400 });
        }

        const payout = Number.parseFloat(payoutRaw);
        if (!Number.isFinite(payout) || payout <= 0) {
          return new Response("Invalid payout", { status: 400 });
        }

        // 1. Log the conversion. Unique(network, transaction_id) blocks duplicate credits
        // if CPAlead retries the same postback.
        const { error: insertError } = await supabaseAdmin
          .from("offerwall_conversions")
          .insert({
            user_id: subid,
            network: "cpalead",
            transaction_id: leadId,
            offer_name: campaignName ?? campaignId ?? null,
            payout_usd: payout,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            // Already processed this lead_id before — respond OK but don't credit again.
            return new Response("1", { status: 200 });
          }
          console.error("CPAlead postback insert error:", insertError);
          return new Response("Server error", { status: 500 });
        }

        // 2. Credit the user's balance atomically.
        const { error: rpcError } = await supabaseAdmin.rpc("increment_balance", {
          p_user_id: subid,
          p_amount: payout,
        });

        if (rpcError) {
          console.error("CPAlead postback balance credit error:", rpcError);
          return new Response("Server error", { status: 500 });
        }

        return new Response("1", { status: 200 });
      },
    },
  },
});
