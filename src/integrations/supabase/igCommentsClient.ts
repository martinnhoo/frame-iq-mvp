import { createClient } from "@supabase/supabase-js";

const IG_COMMENTS_URL = "https://pibkslzvwcnnarlcllmx.supabase.co";
const IG_COMMENTS_PUBLISHABLE_KEY = "sb_publishable_6kSoNBhk8Uy4a4rp7QRPaw_wmi1NMXJ";

export const igCommentsSupabase = createClient(
  IG_COMMENTS_URL,
  IG_COMMENTS_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: "adbrief_igcomments_auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);