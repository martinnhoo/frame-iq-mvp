import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { lazy, Suspense } from "react";

// AdBrief.pro hoje é só portal de cadastro/login (invite-only) +
// dashboard interno (Brilliant Hub). Sem marketing, sem blog, sem
// LP, sem SEO. Toda rota pública não-auth caiu — `/` redireciona
// pra `/signup`.

// ── Auth: eagerly loaded (primeira tela) ─────────────────────────────────────
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import EmailConfirmed from "./pages/EmailConfirmed";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

// ── Legais (compliance Meta) ─────────────────────────────────────────────────
const Terms        = lazy(() => import("./pages/Terms"));
const Privacy      = lazy(() => import("./pages/Privacy"));

// ── Dashboard (Brilliant Hub interno) ────────────────────────────────────────
const AppLayout        = lazy(() => import("./components/layout/AppLayout"));
const AdBriefAI        = lazy(() => import("./pages/dashboard/AdBriefAI"));
const IntelligencePage = lazy(() => import("./pages/dashboard/IntelligencePage"));
const AdDiary         = lazy(() => import("./pages/dashboard/AdDiary"));
const AnalysesList     = lazy(() => import("./pages/dashboard/AnalysesList"));
const AnalysisDetail   = lazy(() => import("./pages/dashboard/AnalysisDetail"));
const NewAnalysis      = lazy(() => import("./pages/dashboard/NewAnalysis"));
const BoardsList       = lazy(() => import("./pages/dashboard/BoardsList"));
const NewBoard         = lazy(() => import("./pages/dashboard/NewBoard"));
const BoardDetail      = lazy(() => import("./pages/dashboard/BoardDetail"));
const TranslatePage    = lazy(() => import("./pages/dashboard/TranslatePage"));
const SettingsPage     = lazy(() => import("./pages/dashboard/SettingsPage"));
const TemplatesPage    = lazy(() => import("./pages/dashboard/TemplatesPage"));
const PersonaPage      = lazy(() => import("./pages/dashboard/PersonaPage"));
const AccountsPage     = lazy(() => import("./pages/dashboard/AccountsPage"));
const AdScorePage      = lazy(() => import("./pages/dashboard/AdScorePage"));
const HookGenerator    = lazy(() => import("./pages/dashboard/HookGenerator"));
const CompetitorDecoder = lazy(() => import("./pages/dashboard/CompetitorDecoder"));
const BriefGenerator   = lazy(() => import("./pages/dashboard/BriefGenerator"));
const CreativeLoopPage = lazy(() => import("./pages/dashboard/CreativeLoopPage"));
const PerformanceDashboard = lazy(() => import("./pages/dashboard/PerformanceDashboard"));
const OAuthCallback    = lazy(() => import("./pages/dashboard/OAuthCallback"));
const LoopImportPage   = lazy(() => import("./pages/dashboard/LoopImportPage"));
const LoopSettingsPage = lazy(() => import("./pages/dashboard/LoopSettingsPage"));
const LoopGuidePage    = lazy(() => import("./pages/dashboard/LoopGuidePage"));
const ReferralPage     = lazy(() => import("./pages/dashboard/ReferralPage"));
const AutopilotLogPage = lazy(() => import("./pages/dashboard/AutopilotLogPage"));
const DebugPage        = lazy(() => import("./pages/dashboard/DebugPage"));

// Cockpit — backoffice admin
const CockpitLayout      = lazy(() => import("./pages/cockpit/CockpitLayout"));
const CockpitOverview    = lazy(() => import("./pages/cockpit/CockpitOverview"));
const CockpitUsers       = lazy(() => import("./pages/cockpit/CockpitUsers"));
const CockpitUserDetail  = lazy(() => import("./pages/cockpit/CockpitUserDetail"));
const CockpitAuditLog    = lazy(() => import("./pages/cockpit/CockpitAuditLog"));
const CockpitDecisionLayer = lazy(() => import("./pages/cockpit/CockpitDecisionLayer"));

// V2 Decision Engine pages
const FeedPage         = lazy(() => import("./pages/dashboard/FeedPage"));
const PatternsPage     = lazy(() => import("./pages/dashboard/PatternsPage"));
const HistoryPage      = lazy(() => import("./pages/dashboard/HistoryPage"));
const OnboardingPage   = lazy(() => import("./pages/dashboard/OnboardingPage"));
const CriarHub         = lazy(() => import("./pages/dashboard/CriarHub"));
const BrilliantHub     = lazy(() => import("./pages/dashboard/BrilliantHub"));
const HubImageGenerator = lazy(() => import("./pages/dashboard/HubImageGenerator"));
const HubLibrary = lazy(() => import("./pages/dashboard/HubLibrary"));
const HubStoryboard = lazy(() => import("./pages/dashboard/HubStoryboard"));
const HubPngGenerator = lazy(() => import("./pages/dashboard/HubPngGenerator"));
const HubCarousel = lazy(() => import("./pages/dashboard/HubCarousel"));
const HubTranscribe = lazy(() => import("./pages/dashboard/HubTranscribe"));
const CampaignsManager = lazy(() => import("./pages/dashboard/CampaignsManager"));

import ToolGate from "./components/ToolGate";

// Minimal spinner shown while lazy chunks load
const PageLoader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07080f" }}>
    <div style={{ width: 32, height: 32, border: "3px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Raiz vai pro signup — LP eliminada, acesso é por convite. */}
              <Route path="/" element={<Navigate to="/signup" replace />} />

              {/* ── Auth ────────────────────────────────────────────── */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/confirm-email" element={<ConfirmEmail />} />
              <Route path="/email-confirmed" element={<EmailConfirmed />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* ── Legais (Meta exige links) ──────────────────────── */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* ── Dashboard (Brilliant Hub interno) ──────────────── */}
              <Route path="/dashboard" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard/hub" replace />} />
                <Route path="hub" element={<BrilliantHub />} />
                <Route path="hub/image" element={<HubImageGenerator />} />
                <Route path="hub/png" element={<HubPngGenerator />} />
                <Route path="hub/storyboard" element={<HubStoryboard />} />
                <Route path="hub/carousel" element={<HubCarousel />} />
                <Route path="hub/transcribe" element={<HubTranscribe />} />
                <Route path="hub/library" element={<HubLibrary />} />
                <Route path="library" element={<Navigate to="/dashboard/hub/library" replace />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="feed/campanhas" element={<CampaignsManager />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="welcome" element={<OnboardingPage />} />
                <Route path="criar" element={<CriarHub />} />
                <Route path="ai" element={<AdBriefAI />} />
                <Route path="intelligence" element={<IntelligencePage />} />
                <Route path="patterns" element={<PatternsPage />} />
                <Route path="diary" element={<AdDiary />} />
                <Route path="analyses" element={<AnalysesList />} />
                <Route path="analyses/new" element={<ToolGate><NewAnalysis /></ToolGate>} />
                <Route path="analyses/:id" element={<AnalysisDetail />} />
                <Route path="boards" element={<ToolGate><BoardsList /></ToolGate>} />
                <Route path="boards/new" element={<ToolGate><NewBoard /></ToolGate>} />
                <Route path="boards/:id" element={<ToolGate><BoardDetail /></ToolGate>} />
                <Route path="translate" element={<ToolGate><TranslatePage /></ToolGate>} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="templates" element={<ToolGate><TemplatesPage /></ToolGate>} />
                <Route path="persona" element={<PersonaPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="debug" element={<DebugPage />} />
                <Route path="ad-score" element={<AdScorePage />} />
                <Route path="hooks" element={<ToolGate><HookGenerator /></ToolGate>} />
                <Route path="competitor" element={<ToolGate><CompetitorDecoder /></ToolGate>} />
                <Route path="script" element={<Navigate to="/dashboard/boards/new" replace />} />
                <Route path="brief" element={<ToolGate><BriefGenerator /></ToolGate>} />
                <Route path="loop" element={<CreativeLoopPage />} />
                <Route path="performance" element={<PerformanceDashboard />} />
                <Route path="loop/connect/:platform/callback" element={<OAuthCallback />} />
                <Route path="loop/import" element={<LoopImportPage />} />
                <Route path="loop/settings" element={<LoopSettingsPage />} />
                <Route path="loop/ai" element={<Navigate to="/dashboard/feed" replace />} />
                <Route path="loop/guide" element={<LoopGuidePage />} />
                <Route path="referral" element={<ReferralPage />} />
                <Route path="autopilot-log" element={<AutopilotLogPage />} />
                <Route path="*" element={<Navigate to="/dashboard/hub" replace />} />
              </Route>

              {/* ── Cockpit: admin-only backoffice ────────────────── */}
              <Route path="/cockpit" element={<CockpitLayout />}>
                <Route index element={<CockpitOverview />} />
                <Route path="users" element={<CockpitUsers />} />
                <Route path="users/:id" element={<CockpitUserDetail />} />
                <Route path="audit" element={<CockpitAuditLog />} />
                <Route path="decision-layer" element={<CockpitDecisionLayer />} />
                <Route path="*" element={<Navigate to="/cockpit" replace />} />
              </Route>

              {/* Catchall — qualquer URL legada cai em 404. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
