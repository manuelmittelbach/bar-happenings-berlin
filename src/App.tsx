import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Analytics } from "@vercel/analytics/react";
import { useAuth } from "@/hooks/useAuth";
import { markEmailJustConfirmed, markEmailJustChanged } from "@/lib/justConfirmed";
import { homeForRole } from "@/lib/roleNav";
import { Spinner } from "@/components/ui/spinner";

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

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

function ForBarsLegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/for-organizers${location.search}`} replace />;
}

// Old auth surface used `/for-organizers?view=signin`. Strip the `view` param
// and forward to /signin so any preserved query (e.g. `link_error`) survives.
function ForOrganizersOrSignin() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get("view") === "signin") {
    params.delete("view");
    const qs = params.toString();
    return <Navigate to={`/signin${qs ? `?${qs}` : ""}`} replace />;
  }
  return <ForBars />;
}

// Old signup URL `/login`. Forward (preserve query) to /signup so any inbound
// link from older emails / bookmarks keeps working.
function LoginLegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/signup${location.search}`} replace />;
}

function DashboardLegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/profile/events${location.search}`} replace />;
}

function BarAccountLegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/profile/bar${location.search}`} replace />;
}

function AdminLegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/profile/admin${location.search}`} replace />;
}

function AdminBarAccountLegacyRedirect() {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={`/profile/admin/bar-account/${id}${location.search}`} replace />;
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
      // Every confirm/reset error funnels to /signin (the single auth surface).
      const isReset = window.location.pathname.includes("reset-password");
      const target = isReset
        ? "/signin?link_error=reset"
        : "/signin?link_error=confirm";
      navigate(target, { replace: true });
      setPending(false);
      return;
    }

    if (loading || !roleResolved || !user) return;

    if (emailChange) {
      markEmailJustChanged();
      navigate("/profile/details", { replace: true });
    } else {
      markEmailJustConfirmed();
      // Confirmed accounts land on their role's home: admins → /profile/admin,
      // organizers → /profile/events, plain users → the events list. Gated on
      // `roleResolved` above, so `role` is authoritative here.
      navigate(homeForRole(role), { replace: true });
    }
    setPending(false);
  }, [pending, loading, roleResolved, user, role, emailChange, navigate]);

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
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
import Signup from "./pages/Signup";
import Signin from "./pages/Signin";
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
import ProfileDetails from "./pages/ProfileDetails";
import { ProfileGate } from "@/components/ProfileGate";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import Info from "./pages/Info";
import Instagram from "./pages/Instagram";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Layout from "@/components/layout/Layout";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { FaviconSpinner } from "@/components/FaviconSpinner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,
      // Default gcTime stays at 30min, but the categories query overrides
      // to Infinity so the persister keeps it across sessions. Other
      // queries get garbage-collected normally and won't bloat the
      // localStorage payload.
      gcTime: 30 * 60 * 1000,
      // One quick retry rides out the most common transient failure (a
      // single network/DB blip), so the user never sees a misleading empty
      // state for a momentary hiccup. Anything longer surfaces fast as the
      // ErrorState retry button — the human is the second "retry", and a
      // second auto-retry rarely succeeds against a real outage anyway
      // (diminishing returns). ~600ms base with jitter (400–800ms) so many
      // clients recovering from the same blip don't re-hit the DB in
      // lockstep ("thundering herd").
      retry: 1,
      retryDelay: () => 400 + Math.random() * 400,
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
      {!Capacitor.isNativePlatform() && <UpdatePrompt />}
      {!Capacitor.isNativePlatform() && <Analytics />}
      {!Capacitor.isNativePlatform() && <FaviconSpinner />}
      <BrowserRouter>
        <AuthCallbackGate>
        <Routes>
          <Route element={<Layout />}>
            {/* Landing sits inside the shared Layout so the global Header
                stays mounted across navigations (no remount, no flash).
                Layout provides the Header + Footer; LandingDraft renders
                only the hero. Native (Capacitor) skips marketing and lands
                straight on the events list. */}
            <Route
              path="/"
              element={Capacitor.isNativePlatform() ? <Navigate to="/events" replace /> : <Landing />}
            />
            <Route path="/events" element={<Index />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/bar/:id" element={<BarDetail />} />
            <Route path="/bars" element={<BarsList />} />
            <Route path="/publish" element={<PublishEvent />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signin" element={<Signin />} />
            {/* Legacy: old "Create account" buttons and email templates may
                still link to /login. Forward (preserving query) to /signup. */}
            <Route path="/login" element={<LoginLegacyRedirect />} />
            <Route path="/dashboard" element={<DashboardLegacyRedirect />} />
            <Route path="/profile/admin" element={<AdminDashboard />} />
            <Route path="/admin" element={<AdminLegacyRedirect />} />
            <Route path="/for-organizers" element={<ForOrganizersOrSignin />} />
            {/* Legacy: old confirm/reset emails and bookmarks may still point
                at /for-bars. Forward (preserving query) so they keep working. */}
            <Route path="/for-bars" element={<ForBarsLegacyRedirect />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/edit-event/:id" element={<EditEvent />} />
            <Route path="/profile/admin/bar-account/:id" element={<EditBarAccount />} />
            <Route path="/admin/bar-account/:id" element={<AdminBarAccountLegacyRedirect />} />
            <Route path="/bar-account" element={<BarAccountLegacyRedirect />} />
            <Route path="/reset-password" element={<UpdatePassword />} />
            <Route path="/confirm" element={<ConfirmEmail />} />
            {/* Signed-in profile pages. ProfileGate blocks pending/rejected
                organizers — every profile URL shows AwaitingApproval until an
                admin approves. */}
            <Route element={<ProfileGate />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/events" element={<OrganizerDashboard />} />
              <Route path="/profile/bar" element={<BarAccount />} />
              <Route path="/profile/details" element={<ProfileDetails />} />
            </Route>
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/info" element={<Info />} />
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
