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

  // Profile still loading — don't flash UpgradeWall to paid users
  if (ctx?.profile === null || ctx?.profile === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (isFree(plan)) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: "calc(100vh - 52px)", padding: "40px 16px 40px", overflowY: "auto" }}>
        <UpgradeWall trigger="tool" inline />
      </div>
    );
  }

  return <>{children}</>;
}
