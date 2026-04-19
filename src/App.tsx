import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AuthRedirectHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has("code");
    const hasSignupHash = window.location.hash.includes("type=signup");
    const hasError = params.has("error") || window.location.hash.includes("error=");

    if (hasError) {
      navigate("/login?expired=1", { replace: true });
      return;
    }

    if (!hasCode && !hasSignupHash) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        sessionStorage.setItem("email-just-confirmed", "1");
        navigate("/my-events", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return null;
}
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import EventDetail from "./pages/EventDetail";
import PublishEvent from "./pages/PublishEvent";
import Login from "./pages/Login";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ForBars from "./pages/ForBars";
import About from "./pages/About";
import MyEvents from "./pages/MyEvents";
import MapPage from "./pages/MapPage";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthRedirectHandler />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/publish" element={<PublishEvent />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<OrganizerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/for-bars" element={<ForBars />} />
          <Route path="/about" element={<About />} />
          <Route path="/my-events" element={<MyEvents />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/reset-password" element={<UpdatePassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
