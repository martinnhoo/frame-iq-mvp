import posthog from 'posthog-js';

let isInitialized = false;

export function initPostHog(): void {
  if (isInitialized) return;

  // Only initialize in production
  if (import.meta.env.PROD) {
    const apiKey = import.meta.env.VITE_POSTHOG_KEY || 'phc_PLACEHOLDER';

    posthog.init(apiKey, {
      api_host: 'https://us.i.posthog.com',
      loaded: (ph) => {
        console.log('PostHog initialized');
      },
    });

    isInitialized = true;
  }
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  if (import.meta.env.PROD && isInitialized) {
    posthog.capture(name, properties);
  }
}

export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>
): void {
  if (import.meta.env.PROD && isInitialized) {
    posthog.identify(userId, traits);
  }
}

export function resetUser(): void {
  if (import.meta.env.PROD && isInitialized) {
    posthog.reset();
  }
}
