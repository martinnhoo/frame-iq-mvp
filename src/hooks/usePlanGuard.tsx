import { useState, useCallback } from "react";
import PlanWall from "@/components/PlanWall";

// Simulates plan check — replace with real check from user profile/subscription
// For now: if no subscription in localStorage, show wall
export function usePlanGuard() {
  const [wallOpen, setWallOpen] = useState(false);
  const [wallFeature, setWallFeature] = useState<string | undefined>(undefined);

  const checkPlan = useCallback((feature?: string): boolean => {
    // Check if user has an active plan
    // This will be replaced with real Supabase subscription check
    const hasPlan = localStorage.getItem("adbrief_plan");
    if (!hasPlan) {
      setWallFeature(feature);
      setWallOpen(true);
      return false;
    }
    return true;
  }, []);

  const PlanWallComponent = wallOpen ? (
    <PlanWall feature={wallFeature} onClose={() => setWallOpen(false)} />
  ) : null;

  return { checkPlan, PlanWallComponent, wallOpen };
}
