export type PatternScope = "tenant" | "global_benchmark";

export function resolveAuthenticatedTenant(
  authenticatedUserId: string | null | undefined,
  requestedUserId?: string | null,
): string {
  if (!authenticatedUserId) throw new Error("Authenticated user is required");
  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    throw new Error("Requested tenant does not match the authenticated tenant");
  }
  return authenticatedUserId;
}

export function patternScopeFilters(userId: string): {
  tenant: { user_id: string; scope: PatternScope };
  global: { user_id: null; scope: PatternScope };
} {
  return {
    tenant: { user_id: userId, scope: "tenant" },
    global: { user_id: null, scope: "global_benchmark" },
  };
}
