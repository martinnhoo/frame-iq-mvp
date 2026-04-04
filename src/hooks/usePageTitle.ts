import { useEffect } from "react";

const BASE = "AdBrief";

/**
 * Sets document.title dynamically on mount / when title changes.
 * Falls back to base "AdBrief" on unmount.
 *
 * Usage: usePageTitle("Performance")  →  "Performance | AdBrief"
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | ${BASE}` : BASE;
    return () => { document.title = prev; };
  }, [title]);
}
