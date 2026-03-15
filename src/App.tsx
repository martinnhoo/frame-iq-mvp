import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Index from "./pages/IndexNew";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Contact from "./pages/Contact";
import BookDemo from "./pages/BookDemo";
import FAQ from "./pages/FAQ";
import Levels from "./pages/Levels";
import FeatureDetail from "./pages/FeatureDetail";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import Careers from "./pages/Careers";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

// Dashboard
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import AnalysesList from "./pages/dashboard/AnalysesList";
import AnalysisDetail from "./pages/dashboard/AnalysisDetail";
import NewAnalysis from "./pages/dashboard/NewAnalysis";
import BoardsList from "./pages/dashboard/BoardsList";
import NewBoard from "./pages/dashboard/NewBoard";
import BoardDetail from "./pages/dashboard/BoardDetail";
import TranslatePage from "./pages/dashboard/TranslatePage";
import IntelligencePage from "./pages/dashboard/IntelligencePage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import TemplatesPage from "./pages/dashboard/TemplatesPage";
import PreflightCheck from "./pages/dashboard/PreflightCheck";
import PersonaPage from "./pages/dashboard/PersonaPage";
import HookGenerator from "./pages/dashboard/HookGenerator";
import CompetitorDecoder from "./pages/dashboard/CompetitorDecoder";
import ScriptGenerator from "./pages/dashboard/ScriptGenerator";
import BriefGenerator from "./pages/dashboard/BriefGenerator";
import CreativeLoopPage from "./pages/dashboard/CreativeLoopPage";
import LoopV2 from "./pages/dashboard/LoopV2";
import MetaOAuthCallback from "./pages/dashboard/MetaOAuthCallback";
import LoopImportPage from "./pages/dashboard/LoopImportPage";
import LoopSettingsPage from "./pages/dashboard/LoopSettingsPage";
import AdBriefAI from "./pages/dashboard/AdBriefAI";
import LoopGuidePage from "./pages/dashboard/LoopGuidePage";
import SupportChat from "./components/SupportChat";
import ToolsIndex from "@/pages/seo/ToolsIndex";
import ToolPage from "@/pages/seo/ToolPage";
import GuidesIndex from "@/pages/seo/GuidesIndex";
import GuidePage from "@/pages/seo/GuidePage";
import { CompareIndex, CompareDetail } from "@/pages/seo/ComparePages";
import PlatformPage    from "@/pages/seo/PlatformPage";
import IndustryPage    from "@/pages/seo/IndustryPage";
import UseCasePage     from "@/pages/seo/UseCasePage";
import RolePage        from "@/pages/seo/RolePage";
import LearnPage       from "@/pages/seo/LearnPage";
import HookTypePage    from "@/pages/seo/HookTypePage";
import MarketPage      from "@/pages/seo/MarketPage";
import AdExamplesPage  from "@/pages/seo/AdExamplesPage";
import { AdsLibraryIndex, AdsLibraryLanding } from "@/pages/seo/AdsLibrary";
import AdHooksPage from "@/pages/seo/AdHooksPage";
import GlossaryPage from "@/pages/seo/GlossaryPage";
import LocationPage from "@/pages/seo/LocationPage";

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
              <Route path="/pricing" element={<Pricing />} />
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
                <Route index element={<LoopV2 />} />
                <Route path="analyses" element={<AnalysesList />} />
                <Route path="analyses/:id" element={<AnalysisDetail />} />
                <Route path="analyses/new" element={<NewAnalysis />} />
                <Route path="boards" element={<BoardsList />} />
                <Route path="boards/new" element={<NewBoard />} />
                <Route path="boards/:id" element={<BoardDetail />} />
                <Route path="translate" element={<TranslatePage />} />
                <Route path="intelligence" element={<IntelligencePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="preflight" element={<PreflightCheck />} />
                <Route path="persona" element={<PersonaPage />} />
                <Route path="hooks" element={<HookGenerator />} />
                <Route path="competitor" element={<CompetitorDecoder />} />
                <Route path="script" element={<ScriptGenerator />} />
                <Route path="brief" element={<BriefGenerator />} />
                <Route path="loop" element={<CreativeLoopPage />} />
                <Route path="loop/v2" element={<LoopV2 />} />
                <Route path="loop/connect/meta/callback" element={<MetaOAuthCallback />} />
                <Route path="loop/import" element={<LoopImportPage />} />
                <Route path="loop/settings" element={<LoopSettingsPage />} />
                <Route path="loop/ai" element={<AdBriefAI />} />
                <Route path="loop/guide" element={<LoopGuidePage />} />
              </Route>              {/* ── SEO: Tools ── */}
              <Route path="/tools"         element={<ToolsIndex />} />
              <Route path="/tools/:slug"   element={<ToolPage />} />

              {/* ── SEO: Guides ── */}
              <Route path="/guides"        element={<GuidesIndex />} />
              <Route path="/guides/:slug"  element={<GuidePage />} />

              {/* ── SEO: Compare ── */}
              <Route path="/compare"           element={<CompareIndex />} />
              <Route path="/compare/:slug"     element={<CompareDetail />} />
              <Route path="/platform/:slug"    element={<PlatformPage />} />
              <Route path="/solutions/:slug"   element={<IndustryPage />} />
              <Route path="/use-case/:slug"    element={<UseCasePage />} />
              <Route path="/for/:slug"         element={<RolePage />} />
              <Route path="/learn/:slug"       element={<LearnPage />} />
              <Route path="/hooks/:slug"       element={<HookTypePage />} />
              <Route path="/markets/:slug"     element={<MarketPage />} />
              <Route path="/examples/:slug"    element={<AdExamplesPage />} />

              {/* ── SEO: Ads Library ── */}
              <Route path="/ads-library"          element={<AdsLibraryIndex />} />
              <Route path="/tiktok-ad-examples"   element={<AdsLibraryLanding />} />
              <Route path="/facebook-ad-examples" element={<AdsLibraryLanding />} />
              <Route path="/ugc-ad-examples"      element={<AdsLibraryLanding />} />
              <Route path="/igaming-ad-examples"  element={<AdsLibraryLanding />} />
              <Route path="/ecommerce-ad-examples" element={<AdsLibraryLanding />} />
              <Route path="/best-ad-hooks"        element={<AdHooksPage />} />
              <Route path="/solutions/:slug"     element={<IndustryPage />} />
              <Route path="/platform/:slug"      element={<PlatformPage />} />
              <Route path="/use-case/:slug"      element={<UseCasePage />} />
              <Route path="/for/:slug"           element={<RolePage />} />
              <Route path="/glossary/:slug"      element={<GlossaryPage />} />
              <Route path="/hooks/:slug"         element={<HookTypePage />} />
              <Route path="/markets/:slug"       element={<LocationPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
