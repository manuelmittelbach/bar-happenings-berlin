import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markEmailJustConfirmed, markEmailJustChanged } from "@/lib/justConfirmed";
import { Spinner } from "@/components/ui/spinner";

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());

  useEffect(() => {
    const key = location.key;
    const handleScroll = () => {
      positions.current.set(key, window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.key]);

  useLayoutEffect(() => {
    if (navigationType === "POP") {
      const saved = positions.current.get(location.key) ?? 0;
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [location.key, navigationType]);

  return null;
}

function detectAuthCallback(): boolean {
  const s = window.location.search;
  const h = window.location.hash;
  const hasError = s.includes("error=") || h.includes("error=");
  if (
    !hasError &&
    window.location.pathname === "/reset-password" &&
    (h.includes("type=recovery") || h.includes("access_token="))
  ) {
    return false;
  }
  return (
    s.includes("code=") ||
    s.includes("error=") ||
    h.includes("access_token=") ||
    h.includes("type=signup") ||
    h.includes("type=email_change") ||
    h.includes("type=email") ||
    h.includes("error=")
  );
}

function isEmailChangeCallback(): boolean {
  const h = window.location.hash;
  return h.includes("type=email_change") || h.includes("type=email");
}

function AuthCallbackGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<boolean>(detectAuthCallback);

  useEffect(() => {
    if (!pending) return;

    const params = new URLSearchParams(window.location.search);
    const hasError = params.has("error") || window.location.hash.includes("error=");

    if (hasError) {
      const isReset = window.location.pathname.includes("reset-password");
      navigate(isReset ? "/login?link_error=reset" : "/login?link_error=confirm", { replace: true });
      setPending(false);
      return;
    }

    const emailChange = isEmailChangeCallback();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (emailChange && (event === "USER_UPDATED" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        markEmailJustChanged();
        navigate("/profile", { replace: true });
        setPending(false);
        return;
      }
      if (event === "SIGNED_IN") {
        markEmailJustConfirmed();
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            const role = data?.role;
            const destination = role === "admin" ? "/admin" : role === "organizer" ? "/dashboard" : "/my-events";
            navigate(destination, { replace: true });
            setPending(false);
          });
      }
    });
    return () => subscription.unsubscribe();
  }, [pending, navigate]);

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
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
import Profile from "./pages/Profile";
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
        <ScrollManager />
        <AuthCallbackGate>
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
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </AuthCallbackGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
