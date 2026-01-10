import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAgeVerification } from "@/hooks/useAgeVerification";
import AgeGate from "@/components/AgeGate";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import VideoAnalytics from "./pages/VideoAnalytics";
import CreatorDashboard from "./pages/CreatorDashboard";
import Milestones from "./pages/Milestones";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ParentDashboard from "./pages/ParentDashboard";

const queryClient = new QueryClient();

// Component to handle age gate logic
const AppContent = () => {
  const { isVerified, verify } = useAgeVerification();
  const location = useLocation();

  // Allow access to legal pages without verification
  const legalPages = ["/privacy-policy", "/terms-of-service"];
  const isLegalPage = legalPages.includes(location.pathname);

  // Show loading while checking verification status
  if (isVerified === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show age gate if not verified and not on a legal page
  if (!isVerified && !isLegalPage) {
    return <AgeGate onVerified={verify} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/feed" element={<Feed />} />
      <Route path="/search" element={<Search />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/video-analytics/:videoId" element={<VideoAnalytics />} />
      <Route path="/creator-dashboard" element={<CreatorDashboard />} />
      <Route path="/milestones" element={<Milestones />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/parent-dashboard" element={<ParentDashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
