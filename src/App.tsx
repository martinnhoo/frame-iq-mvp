import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { lazy, Suspense } from "react";

// ── Eagerly loaded — needed on first paint for public routes ─────────────────
import Index from "./pages/IndexNew";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

// ── Lazily loaded — only fetched when user navigates there ───────────────────
const Blog         = lazy(() => import("./pages/Blog"));
const BlogPost     = lazy(() => import("./pages/BlogPost"));
const Contact      = lazy(() => import("./pages/Contact"));
const BookDemo     = lazy(() => import("./pages/BookDemo"));
const FAQ          = lazy(() => import("./pages/FAQ"));
const Levels       = lazy(() => import("./pages/Levels"));
const FeatureDetail = lazy(() => import("./pages/FeatureDetail"));
const Features     = lazy(() => import("./pages/Features"));
const Terms        = lazy(() => import("./pages/Terms"));
const Privacy      = lazy(() => import("./pages/Privacy"));
const Refund       = lazy(() => import("./pages/Refund"));
const Careers      = lazy(() => import("./pages/Careers"));

// Dashboard — largest chunk, never loaded on landing page
const DashboardLayout  = lazy(() => import("./components/dashboard/DashboardLayout"));
const AdBriefAI        = lazy(() => import("./pages/dashboard/AdBriefAI"));
const IntelligencePage = lazy(() => import("./pages/dashboard/IntelligencePage"));
const AnalysesList     = lazy(() => import("./pages/dashboard/AnalysesList"));
const AnalysisDetail   = lazy(() => import("./pages/dashboard/AnalysisDetail"));
const NewAnalysis      = lazy(() => import("./pages/dashboard/NewAnalysis"));
const BoardsList       = lazy(() => import("./pages/dashboard/BoardsList"));
const NewBoard         = lazy(() => import("./pages/dashboard/NewBoard"));
const BoardDetail      = lazy(() => import("./pages/dashboard/BoardDetail"));
const TranslatePage    = lazy(() => import("./pages/dashboard/TranslatePage"));
const SettingsPage     = lazy(() => import("./pages/dashboard/SettingsPage"));
const TemplatesPage    = lazy(() => import("./pages/dashboard/TemplatesPage"));
const PreflightCheck   = lazy(() => import("./pages/dashboard/PreflightCheck"));
const PersonaPage      = lazy(() => import("./pages/dashboard/PersonaPage"));
const AccountsPage     = lazy(() => import("./pages/dashboard/AccountsPage"));
const HookGenerator    = lazy(() => import("./pages/dashboard/HookGenerator"));
const CompetitorDecoder = lazy(() => import("./pages/dashboard/CompetitorDecoder"));
const ScriptGenerator  = lazy(() => import("./pages/dashboard/ScriptGenerator"));
const BriefGenerator   = lazy(() => import("./pages/dashboard/BriefGenerator"));
const CreativeLoopPage = lazy(() => import("./pages/dashboard/CreativeLoopPage"));
const LoopV2           = lazy(() => import("./pages/dashboard/LoopV2"));
const OAuthCallback    = lazy(() => import("./pages/dashboard/OAuthCallback"));
const LoopImportPage   = lazy(() => import("./pages/dashboard/LoopImportPage"));
const LoopSettingsPage = lazy(() => import("./pages/dashboard/LoopSettingsPage"));
const LoopGuidePage    = lazy(() => import("./pages/dashboard/LoopGuidePage"));

// SEO pages — lazily loaded, rarely visited from landing
const ToolsIndex    = lazy(() => import("@/pages/seo/ToolsIndex"));
const ToolPage      = lazy(() => import("@/pages/seo/ToolPage"));
const GuidesIndex   = lazy(() => import("@/pages/seo/GuidesIndex"));
const GuidePage     = lazy(() => import("@/pages/seo/GuidePage"));
const PlatformPage  = lazy(() => import("@/pages/seo/PlatformPage"));
const IndustryPage  = lazy(() => import("@/pages/seo/IndustryPage"));
const UseCasePage   = lazy(() => import("@/pages/seo/UseCasePage"));
const RolePage      = lazy(() => import("@/pages/seo/RolePage"));
const LearnPage     = lazy(() => import("@/pages/seo/LearnPage"));
const HookTypePage  = lazy(() => import("@/pages/seo/HookTypePage"));
const AdExamplesPage = lazy(() => import("@/pages/seo/AdExamplesPage"));
const AdHooksPage   = lazy(() => import("@/pages/seo/AdHooksPage"));
const GlossaryPage  = lazy(() => import("@/pages/seo/GlossaryPage"));
const LocationPage  = lazy(() => import("@/pages/seo/LocationPage"));

const CompareIndex  = lazy(() => import("@/pages/seo/ComparePages").then(m => ({ default: m.CompareIndex })));
const CompareDetail = lazy(() => import("@/pages/seo/ComparePages").then(m => ({ default: m.CompareDetail })));
const AdsLibraryIndex   = lazy(() => import("@/pages/seo/AdsLibrary").then(m => ({ default: m.AdsLibraryIndex })));
const AdsLibraryLanding = lazy(() => import("@/pages/seo/AdsLibrary").then(m => ({ default: m.AdsLibraryLanding })));

import ToolGate from "./components/ToolGate";
import SupportChat from "./components/SupportChat";

// Minimal spinner shown while lazy chunks load
const PageLoader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07080f" }}>
    <div style={{ width: 32, height: 32, border: "3px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SupportChat />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/book-demo" element={<BookDemo />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/levels" element={<Levels />} />
              <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refund" element={<Refund />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/features/:slug" element={<FeatureDetail />} />
              <Route path="/features" element={<Features />} />
              <Route path="/confirm-email" element={<ConfirmEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Dashboard with sidebar layout */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard/ai" replace />} />
                <Route path="ai" element={<AdBriefAI />} />
                <Route path="intelligence" element={<IntelligencePage />} />
                <Route path="analyses" element={<AnalysesList />} />
                <Route path="analyses/:id" element={<AnalysisDetail />} />
                <Route path="analyses/new" element={<ToolGate><NewAnalysis /></ToolGate>} />
                <Route path="boards" element={<ToolGate><BoardsList /></ToolGate>} />
                <Route path="boards/new" element={<ToolGate><NewBoard /></ToolGate>} />
                <Route path="boards/:id" element={<ToolGate><BoardDetail /></ToolGate>} />
                <Route path="translate" element={<ToolGate><TranslatePage /></ToolGate>} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="templates" element={<ToolGate><TemplatesPage /></ToolGate>} />
                <Route path="preflight" element={<ToolGate><PreflightCheck /></ToolGate>} />
                <Route path="persona" element={<PersonaPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="hooks" element={<ToolGate><HookGenerator /></ToolGate>} />
                <Route path="competitor" element={<ToolGate><CompetitorDecoder /></ToolGate>} />
                <Route path="script" element={<ToolGate><ScriptGenerator /></ToolGate>} />
                <Route path="brief" element={<ToolGate><BriefGenerator /></ToolGate>} />
                <Route path="loop" element={<CreativeLoopPage />} />
                <Route path="loop/v2" element={<LoopV2 />} />
                <Route path="loop/connect/:platform/callback" element={<OAuthCallback />} />
                <Route path="loop/import" element={<LoopImportPage />} />
                <Route path="loop/settings" element={<LoopSettingsPage />} />
                <Route path="loop/ai" element={<Navigate to="/dashboard/ai" replace />} />
                <Route path="loop/guide" element={<LoopGuidePage />} />
              </Route>

              {/* ── SEO: Tools ── */}
              <Route path="/tools"         element={<ToolsIndex />} />
              <Route path="/tools/:slug"   element={<ToolPage />} />

              {/* ── SEO: Guides ── */}
              <Route path="/guides"        element={<GuidesIndex />} />
              <Route path="/guides/:slug"  element={<GuidePage />} />

              {/* ── SEO: Compare ── */}
              <Route path="/compare"       element={<CompareIndex />} />
              <Route path="/compare/:slug" element={<CompareDetail />} />
              <Route path="/platform/:slug"    element={<PlatformPage />} />
              <Route path="/solutions/:slug"   element={<IndustryPage />} />
              <Route path="/use-case/:slug"    element={<UseCasePage />} />
              <Route path="/for/:slug"         element={<RolePage />} />
              <Route path="/learn/:slug"       element={<LearnPage />} />
              <Route path="/hooks/:slug"       element={<HookTypePage />} />
              <Route path="/markets/:slug"     element={<LocationPage />} />
              <Route path="/examples/:slug"    element={<AdExamplesPage />} />

              {/* ── SEO: Ads Library ── */}
              <Route path="/ads-library"           element={<AdsLibraryIndex />} />
              <Route path="/tiktok-ad-examples"    element={<AdsLibraryLanding />} />
              <Route path="/facebook-ad-examples"  element={<AdsLibraryLanding />} />
              <Route path="/ugc-ad-examples"       element={<AdsLibraryLanding />} />
              <Route path="/igaming-ad-examples"   element={<AdsLibraryLanding />} />
              <Route path="/ecommerce-ad-examples" element={<AdsLibraryLanding />} />
              <Route path="/best-ad-hooks"         element={<AdHooksPage />} />
              <Route path="/glossary/:slug"        element={<GlossaryPage />} />

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
