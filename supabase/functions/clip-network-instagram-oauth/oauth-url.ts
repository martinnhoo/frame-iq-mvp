const INSTAGRAM_AUTH_ORIGIN = "https://www.instagram.com";

export function buildInstagramAuthorizationUrl({
  appId,
  redirectUri,
  scopes,
  state,
}: {
  appId: string;
  redirectUri: string;
  scopes: string;
  state: string;
}) {
  const url = new URL(`${INSTAGRAM_AUTH_ORIGIN}/oauth/authorize`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  return url;
}

export function isInstagramAuthorizationUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "www.instagram.com" || url.hostname === "instagram.com")
      && url.pathname.replace(/\/$/, "") === "/oauth/authorize";
  } catch {
    return false;
  }
}
