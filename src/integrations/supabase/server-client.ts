import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://foofdltskckbrmihisll.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set — server-side Supabase writes will fail.",
  );
}

// Service-role client: bypasses Row Level Security.
// NEVER import this file from any client-side/browser component — server routes only.
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
