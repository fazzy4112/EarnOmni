import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://foofdltskckbrmihisll.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb2ZkbHRza2NrYnJtaWhpc2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzMwNDQsImV4cCI6MjA5NjIwOTA0NH0.bMu7t3XZlvRwqZ1vHe5tFTgtOlwh1LB8vO1G2S3Wwes"

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
