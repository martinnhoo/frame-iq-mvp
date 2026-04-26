/**
 * EN SEO No-Index Layout
 *
 * Wraps all legacy English programmatic SEO routes (tools/, guides/,
 * learn/, compare/, platform/, etc) so each one gets a
 *   <meta name="robots" content="noindex, follow">
 * tag automatically.
 *
 * WHY:
 * AdBrief is now positioned 100% for the BR market. The 160 EN pages
 * still exist as React routes (so anyone with a bookmarked URL doesn't
 * 404), but we don't want Google indexing them anymore — they were
 * splitting the site's language signal and hurting the new PT-BR BOFU
 * pages' rankings. `noindex, follow` tells Google to:
 *   - Drop these pages from search results (over 1-2 weeks)
 *   - Still follow internal links from them (preserves authority flow
 *     to the PT pages they might link to)
 *
 * USAGE in App.tsx:
 *   <Route element={<EnSeoNoIndexLayout />}>
 *     <Route path="/tools" element={<ToolsIndex />} />
 *     <Route path="/tools/:slug" element={<ToolPage />} />
 *     …
 *   </Route>
 *
 * When AdBrief expands global later, replace this layout with proper
 * locale-aware routes (/en/<slug>) and remove the noindex.
 */
import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function EnSeoNoIndexLayout() {
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <Outlet />
    </>
  );
}
