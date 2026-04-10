// GA4 custom events — uses the gtag already loaded in index.html (G-X0P1QLGZLG)

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(...args);
  }
}

export function initPostHog(): void {
  // no-op — gtag is already initialized via index.html script tag
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  gtag("event", name, properties);
}

export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>
): void {
  gtag("set", "user_properties", { user_id: userId, ...traits });
}

export function resetUser(): void {
  // GA4 doesn't need explicit reset — session ends naturally
}
