import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AccountProvider } from "@/providers/AccountProvider";
import { lazy, Suspense } from "react";

// ── Eagerly loaded — needed on first paint for public routes ─────────────────
import Index from "./pages/IndexNew";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import EmailConfirmed from "./pages/EmailConfirmed";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

// ── Lazily loaded — public pages ────────────────────────────────────────────
const Blog          = lazy(() => import("./pages/Blog"));
const BlogPost      = lazy(() => import("./pages/BlogPost"));
const Contact       = lazy(() => import("./pages/Contact"));
const BookDemo      = lazy(() => import("./pages/BookDemo"));
const FAQ           = lazy(() => import("./pages/FAQ"));
const Levels        = lazy(() => import("./pages/Levels"));
const FeatureDetail = lazy(() => import("./pages/FeatureDetail"));
const Features      = lazy(() => import("./pages/Features"));
const Terms         = lazy(() => import("./pages/Terms"));
const Privacy       = lazy(() => import("./pages/Privacy"));
const Refund        = lazy(() => import("./pages/Refund"));
const Careers       = lazy(() => import("./pages/Careers"));
const Pricing       = lazy(() => import("./pages/Pricing"));
const Demo          = lazy(() => import("./pages/Demo"));
const DemoShare     = lazy(() => import("./pages/DemoShare"));
const Diagnostico   = lazy(() => import("./pages/Diagnostico"));
const Gestao        = lazy(() => import("./pages/Gestao"));
const Criativo      = lazy(() => import("./pages/Criativo"));

// ── V2 Decision Engine — NEW primary dashboard experience ───────────────────
const AppLayout        = lazy(() => import("./components/layout/AppLayout"));
const FeedPage         = lazy(() => import("./pages/dashboard/FeedPage"));
const HistoryPage      = lazy(() => import("./pages/dashboard/HistoryPage"));
const OnboardingPage   = lazy(() => import("./pages/dashboard/OnboardingPage"));
const SettingsPage     = lazy(() => import("./pages/dashboard/SettingsPage"));
const AccountsPage     = lazy(() => import("./pages/dashboard/AccountsPage"));

// ── Legacy tools kept under /dashboard/create/* ─────────────────────────────
const HookGenerator     = lazy(() => import("./pages/dashboard/HookGenerator"));
const CompetitorDecoder = lazy(() => import("./pages/dashboard/CompetitorDecoder"));
const ScriptGenerator   = lazy(() => import("./pages/dashboard/ScriptGenerator"));
const BriefGenerator    = lazy(() => import("./pages/dashboard/BriefGenerator"));
const AdBriefAI         = lazy(() => import("./pages/dashboard/AdBriefAI"));
const AdScorePage       = lazy(() => import("./pages/dashboard/AdScorePage"));
const PersonaPage       = lazy(() => import("./pages/dashboard/PersonaPage"));
const PerformanceDashboard = lazy(() => import("./pages/dashboard/PerformanceDashboard"));
const AccountDiagnostic = lazy(() => import("./pages/dashboard/AccountDiagnostic"));
const OAuthCallback     = lazy(() => import("./pages/dashboard/OAuthCallback"));
const ReferralPage      = lazy(() => import("./pages/dashboard/ReferralPage"));

// SEO pages — lazily loaded
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
        <AccountProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <SupportChat />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public routes ── */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/book-demo" element={<BookDemo />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/levels" element={<Levels />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/s/:shareId" element={<DemoShare />} />
                <Route path="/diagnostico" element={<Diagnostico />} />
                <Route path="/gestao" element={<Gestao />} />
                <Route path="/criativo" element={<Criativo />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/features/:slug" element={<FeatureDetail />} />
                <Route path="/features" element={<Features />} />
                <Route path="/confirm-email" element={<ConfirmEmail />} />
                <Route path="/email-confirmed" element={<EmailConfirmed />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<Onboarding />} />

                {/* ══════════════════════════════════════════════════════════
                    V2 DECISION ENGINE — Primary dashboard experience
                    The Copilot Feed is the new default.
                   ══════════════════════════════════════════════════════════ */}
                <Route path="/dashboard" element={<AppLayout />}>
                  {/* Default: Copilot Feed */}
                  <Route index element={<FeedPage />} />
                  <Route path="feed" element={<Navigate to="/dashboard" replace />} />

                  {/* V2 core pages */}
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="welcome" element={<OnboardingPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="patterns" element={<PerformanceDashboard />} />

                  {/* Creative tools — under /dashboard/create/* */}
                  <Route path="create" element={<AdBriefAI />} />
                  <Route path="create/hooks" element={<ToolGate><HookGenerator /></ToolGate>} />
                  <Route path="create/competitor" element={<ToolGate><CompetitorDecoder /></ToolGate>} />
                  <Route path="create/script" element={<ToolGate><ScriptGenerator /></ToolGate>} />
                  <Route path="create/brief" element={<ToolGate><BriefGenerator /></ToolGate>} />
                  <Route path="create/ad-score" element={<AdScorePage />} />
                  <Route path="create/persona" element={<PersonaPage />} />

                  {/* Legacy routes — kept for backward compat */}
                  <Route path="ai" element={<Navigate to="/dashboard" replace />} />
                  <Route path="diagnostic" element={<AccountDiagnostic />} />
                  <Route path="loop/connect/:platform/callback" element={<OAuthCallback />} />
                  <Route path="referral" element={<ReferralPage />} />

                  {/* Catch-all → Feed */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>

                {/* ── SEO routes ── */}
                <Route path="/tools" element={<ToolsIndex />} />
                <Route path="/tools/:slug" element={<ToolPage />} />
                <Route path="/guides" element={<GuidesIndex />} />
                <Route path="/guides/:slug" element={<GuidePage />} />
                <Route path="/compare" element={<CompareIndex />} />
                <Route path="/compare/:slug" element={<CompareDetail />} />
                <Route path="/platform/:slug" element={<PlatformPage />} />
                <Route path="/solutions/:slug" element={<IndustryPage />} />
                <Route path="/use-case/:slug" element={<UseCasePage />} />
                <Route path="/for/:slug" element={<RolePage />} />
                <Route path="/learn/:slug" element={<LearnPage />} />
                <Route path="/hooks/:slug" element={<HookTypePage />} />
                <Route path="/markets/:slug" element={<LocationPage />} />
                <Route path="/examples/:slug" element={<AdExamplesPage />} />
                <Route path="/ads-library" element={<AdsLibraryIndex />} />
                <Route path="/tiktok-ad-examples" element={<AdsLibraryLanding />} />
                <Route path="/facebook-ad-examples" element={<AdsLibraryLanding />} />
                <Route path="/ugc-ad-examples" element={<AdsLibraryLanding />} />
                <Route path="/igaming-ad-examples" element={<AdsLibraryLanding />} />
                <Route path="/ecommerce-ad-examples" element={<AdsLibraryLanding />} />
                <Route path="/best-ad-hooks" element={<AdHooksPage />} />
                <Route path="/glossary/:slug" element={<GlossaryPage />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AccountProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
