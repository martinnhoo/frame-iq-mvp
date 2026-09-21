import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://pibkslzvwcnnarlcllmx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6kSoNBhk8Uy4a4rp7QRPaw_wmi1NMXJ';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'adbrief_igcomments_auth',
  }
});
