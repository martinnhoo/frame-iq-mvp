import { createClient } from "@supabase/supabase-js";

const url = "https://pibkslzvwcnnarlcllmx.supabase.co";
const publishableKey = "sb_publishable_6kSoNBhk8Uy4a4rp7QRPaw_wmi1NMXJ";

export const igCommentsSupabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "adbrief_igcomments_auth",
  },
});
