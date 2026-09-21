# IG Comments workspace

## Goal
Add a standalone, production-ready `/igcomments` workspace backed only by the active IG Comments project, while preserving every legacy dashboard path and its existing backend client.

## Implementation

1. **Isolated authentication client**
   - Add `igCommentsSupabase` with the supplied active project URL and publishable key.
   - Persist its session under `adbrief_igcomments_auth`, isolated from the legacy session.
   - Leave the generated/default client unchanged.

2. **Standalone route and login routing**
   - Lazy-load `/igcomments` at the root router level, outside `AppLayout`.
   - In Login, read and validate `next`; use the isolated client only when it points to `/igcomments`.
   - Send Google OAuth back to `/igcomments`; after email login, navigate to the validated destination.
   - Preserve normal dashboard login behavior exactly as-is.
   - Convert legacy-client network failures into a clear backend-unavailable message without attempting cross-backend login.
   - Add a subtle “IG Comments” link to the login screen.

3. **IG Comments workspace**
   - Require an isolated IG Comments session and redirect signed-out visitors to `/login?next=/igcomments`.
   - Load only the current user’s connected Instagram accounts and show label, handle, and connection status.
   - Create/select ad targets with URL and optional brief, then load their existing drafts.
   - Invoke `ig-comments-generate` with the ad URL, context, connected account labels, and a requested count of six.
   - Persist the six returned drafts and render review controls: editable copy, intent, optional account assignment, status, Approve, Skip, and Copy.
   - Support saving edits/account selection, clearing a target’s drafts, and deleting a target.
   - Include scoped loading, empty, error, and disabled states plus concise toasts.
   - Keep the product explicitly review-and-copy only; no automated posting or browser automation.

4. **Verification**
   - Run focused TypeScript checks/tests through the project harness.
   - Verify `/igcomments`, `/login?next=/igcomments`, and unchanged `/login` routing behavior in the browser at desktop and mobile sizes.
   - Report the exact changed-file list and any backend/schema issue encountered.

## Technical notes
- Dynamic tables in the separate project will use a locally typed client boundary rather than modifying generated legacy database types.
- `next` will be allowlisted to same-app `/igcomments` paths to prevent open redirects.
- Database mutations remain scoped by both `user_id` filters and existing row-level security.
