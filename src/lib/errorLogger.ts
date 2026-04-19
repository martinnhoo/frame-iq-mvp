/**
 * Global error logger — catches JS errors and unhandled promise rejections
 * that escape React's ErrorBoundary. Logs to Supabase error_logs table.
 *
 * Import once in main.tsx: import '@/lib/errorLogger';
 */
import { supabase } from '@/integrations/supabase/client';

const MAX_MSG = 500;
const MAX_STACK = 2000;

function logError(entry: {
  error_type: string;
  message: string;
  stack?: string;
  component?: string;
}) {
  // Get current user ID if available (fire-and-forget)
  supabase.auth.getSession().then(({ data }) => {
    const userId = data?.session?.user?.id || null;
    (supabase.from('error_logs' as any) as any).insert({
      user_id: userId,
      error_type: entry.error_type,
      message: entry.message?.slice(0, MAX_MSG),
      stack: entry.stack?.slice(0, MAX_STACK),
      component: entry.component?.slice(0, 500),
      url: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 200),
      metadata: { timestamp: new Date().toISOString() },
    }).then(() => {}).catch(() => {});
  }).catch(() => {});
}

// ── Global JS errors ─────────────────────────────────────────────────────────
window.onerror = (message, source, lineno, colno, error) => {
  // Skip errors from extensions or cross-origin scripts
  if (source && !source.includes(window.location.origin)) return;

  logError({
    error_type: 'js_error',
    message: String(message),
    stack: error?.stack || `${source}:${lineno}:${colno}`,
    component: source || undefined,
  });
};

// ── Unhandled promise rejections ─────────────────────────────────────────────
window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;

  logError({
    error_type: 'unhandled_rejection',
    message,
    stack,
  });
};

// Log that error tracking is active (only in dev)
if (import.meta.env.DEV) {
  console.log('[AdBrief] Global error logger active');
}
