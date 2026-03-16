import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import UpgradeWall from "@/components/UpgradeWall";
import { isFree } from "@/lib/planLimits";

interface ToolGateProps {
  children: React.ReactNode;
}

/**
 * Wraps any tool page and shows UpgradeWall inline if user is on free plan.
 * Usage: wrap tool routes in App.tsx or inside the tool component itself.
 */
export default function ToolGate({ children }: ToolGateProps) {
  const ctx = useOutletContext<DashboardContext>();
  const plan = ctx?.profile?.plan;

  if (isFree(plan)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 160px)", padding: "24px 16px" }}>
        <UpgradeWall trigger="tool" inline />
      </div>
    );
  }

  return <>{children}</>;
}
