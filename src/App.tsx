import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import { markEmailJustConfirmed, markEmailJustChanged } from "@/lib/justConfirmed";
import { Spinner } from "@/components/ui/spinner";

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const prevPathname = useRef(location.pathname);

  useEffect(() => {
    const key = location.key;
    const handleScroll = () => {
      positions.current.set(key, window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.key]);

  useLayoutEffect(() => {
    const pathnameChanged = prevPathname.current !== location.pathname;
    prevPathname.current = location.pathname;
    // Filter-only updates (?q=, ?c=, etc) don't change pathname — leave scroll
    // where the user is. Page navigations behave as before.
    if (!pathnameChanged) return;
    if (navigationType === "POP") {
      const saved = positions.current.get(location.key) ?? 0;
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [location.key, location.pathname, navigationType]);

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
  const { user, role, roleResolved, loading } = useAuth();
  const [pending, setPending] = useState<boolean>(detectAuthCallback);
  const emailChange = useRef(isEmailChangeCallback()).current;

  useEffect(() => {
    if (!pending) return;

    const params = new URLSearchParams(window.location.search);
    const hasError = params.has("error") || window.location.hash.includes("error=");

    if (hasError) {
      // Bar-owner-only: every confirm/reset error funnels to /for-bars (the
      // single auth surface). The `params` look-up for `?bar=1` is gone
      // because there's no longer a non-bar signup branch to disambiguate.
      const isReset = window.location.pathname.includes("reset-password");
      const target = isReset
        ? "/for-bars?link_error=reset"
        : "/for-bars?link_error=confirm";
      navigate(target, { replace: true });
      setPending(false);
      return;
    }

    if (loading || !roleResolved || !user) return;

    if (emailChange) {
      markEmailJustChanged();
      navigate("/profile", { replace: true });
    } else {
      markEmailJustConfirmed();
      // Bar-owner-only: confirmed accounts land on the role's home. Stray
      // `"user"` accounts fall through to /dashboard which guards them out
      // to /.
      const destination = role === "admin" ? "/admin" : "/dashboard";
      navigate(destination, { replace: true });
    }
    setPending(false);
  }, [pending, loading, roleResolved, user, role, emailChange, navigate]);

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
import ConfirmEmail from "./pages/ConfirmEmail";
import MapPage from "./pages/MapPage";
import UpdatePassword from "./pages/UpdatePassword";
import EditEvent from "./pages/EditEvent";
import EditBarAccount from "./pages/EditBarAccount";
import BarAccount from "./pages/BarAccount";
import BarDetail from "./pages/BarDetail";
import BarsList from "./pages/BarsList";
import Profile from "./pages/Profile";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import Instagram from "./pages/Instagram";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Layout from "@/components/layout/Layout";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,
      // Default gcTime stays at 30min, but the categories query overrides
      // to Infinity so the persister keeps it across sessions. Other
      // queries get garbage-collected normally and won't bloat the
      // localStorage payload.
      gcTime: 30 * 60 * 1000,
      retry: 0,
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "barlin-query-cache",
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: localStoragePersister,
      // Persist queries whose data is stable enough to serve from cache
      // on first paint (eliminates the brief async "flash" between
      // initial render and query resolution). Everything else (event
      // lists, venues, auth, profile) refetches fresh per session.
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const key = query.queryKey;
          if (key[0] === "categories") return true;
          // useEventSeries → ["events", "series", seriesId]
          if (key[0] === "events" && key[1] === "series") return true;
          return false;
        },
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdatePrompt />
      <BrowserRouter>
        <ScrollManager />
        <AuthCallbackGate>
        <Routes>
          {/* Landing owns its own chrome (nav + footer) — rendered
              outside Layout so the global Header doesn't stack on top
              of the marketing nav. Sits at `/` so visitors land on the
              marketing page; the events list moved to `/events`.
              Native (Capacitor) skips marketing entirely and lands
              straight on the events list. */}
          <Route
            path="/"
            element={Capacitor.isNativePlatform() ? <Navigate to="/events" replace /> : <Landing />}
          />
          <Route element={<Layout />}>
            <Route path="/events" element={<Index />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/bar/:id" element={<BarDetail />} />
            <Route path="/bars" element={<BarsList />} />
            <Route path="/publish" element={<PublishEvent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<OrganizerDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/for-bars" element={<ForBars />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/edit-event/:id" element={<EditEvent />} />
            <Route path="/admin/bar-account/:id" element={<EditBarAccount />} />
            <Route path="/bar-account" element={<BarAccount />} />
            <Route path="/reset-password" element={<UpdatePassword />} />
            <Route path="/confirm" element={<ConfirmEmail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/instagram" element={<Instagram />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </AuthCallbackGate>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
