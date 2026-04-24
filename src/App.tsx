import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
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
      const isReset = window.location.pathname.includes("reset-password");
      navigate(isReset ? "/login?link_error=reset" : "/login?link_error=confirm", { replace: true });
      return;
    }

    if (!hasCode && !hasSignupHash) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        sessionStorage.setItem("email-just-confirmed", "1");
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            const role = data?.role;
            const destination = role === "admin" ? "/admin" : role === "organizer" ? "/dashboard" : "/my-events";
            navigate(destination, { replace: true });
          });
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
import Contact from "./pages/Contact";
import MyEvents from "./pages/MyEvents";
import MapPage from "./pages/MapPage";
import UpdatePassword from "./pages/UpdatePassword";
import EditEvent from "./pages/EditEvent";
import EditBarAccount from "./pages/EditBarAccount";
import NotFound from "./pages/NotFound";
import Layout from "@/components/layout/Layout";

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
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/publish" element={<PublishEvent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<OrganizerDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/for-bars" element={<ForBars />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/my-events" element={<MyEvents />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/edit-event/:id" element={<EditEvent />} />
            <Route path="/admin/bar-account/:id" element={<EditBarAccount />} />
            <Route path="/reset-password" element={<UpdatePassword />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
