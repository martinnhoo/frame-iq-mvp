import { describe, expect, it } from "vitest";
import { buildInstagramAuthorizationUrl, isInstagramAuthorizationUrl } from "../../supabase/functions/clip-network-instagram-oauth/oauth-url";

describe("Instagram OAuth URL", () => {
  it("always uses Instagram Login with the configured Instagram app", () => {
    const url = buildInstagramAuthorizationUrl({
      appId: "instagram-app-id",
      redirectUri: "https://adbrief.pro/dashboard/clips/connect/instagram/callback",
      scopes: "instagram_business_basic,instagram_business_content_publish",
      state: "signed-state",
    });

    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("instagram-app-id");
    expect(url.searchParams.get("enable_fb_login")).toBe("0");
    expect(url.searchParams.get("force_authentication")).toBe("1");
  });

  it("rejects Facebook and lookalike authorization hosts", () => {
    expect(isInstagramAuthorizationUrl("https://www.instagram.com/oauth/authorize?client_id=1")).toBe(true);
    expect(isInstagramAuthorizationUrl("https://facebook.com/dialog/oauth")).toBe(false);
    expect(isInstagramAuthorizationUrl("https://instagram.com.example.test/oauth/authorize")).toBe(false);
  });
});
