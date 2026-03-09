import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Contact from "./pages/Contact";
import BookDemo from "./pages/BookDemo";
import FAQ from "./pages/FAQ";
import FeatureDetail from "./pages/FeatureDetail";
import Pricing from "./pages/Pricing";
import Careers from "./pages/Careers";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Dashboard
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import AnalysesList from "./pages/dashboard/AnalysesList";
import NewAnalysis from "./pages/dashboard/NewAnalysis";
import BoardsList from "./pages/dashboard/BoardsList";
import NewBoard from "./pages/dashboard/NewBoard";
import BoardDetail from "./pages/dashboard/BoardDetail";
import VideosList from "./pages/dashboard/VideosList";
import TranslatePage from "./pages/dashboard/TranslatePage";
import IntelligencePage from "./pages/dashboard/IntelligencePage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import TemplatesPage from "./pages/dashboard/TemplatesPage";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/book-demo" element={<BookDemo />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/features/:slug" element={<FeatureDetail />} />
              <Route path="/confirm-email" element={<ConfirmEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Dashboard with sidebar layout */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="analyses" element={<AnalysesList />} />
                <Route path="analyses/new" element={<NewAnalysis />} />
                <Route path="boards" element={<BoardsList />} />
                <Route path="boards/new" element={<NewBoard />} />
                <Route path="boards/:id" element={<BoardDetail />} />
                <Route path="videos" element={<VideosList />} />
                <Route path="translate" element={<TranslatePage />} />
                <Route path="intelligence" element={<IntelligencePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="templates" element={<TemplatesPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
