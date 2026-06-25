import { createContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markEmailJustChanged } from "@/lib/justConfirmed";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: "user" | "organizer" | "admin" | null;
  roleResolved: boolean;
  approvalStatus: ApprovalStatus | null;
}

type SignUpVenueData =
  | { existingVenueId: string; website?: string; instagram?: string; phone?: string }
  | { name: string; address: string; neighborhood?: string; website?: string; instagram?: string; phone?: string };

export interface AuthContextValue extends AuthState {
  signUp: (
    email: string,
    password: string,
    name: string,
    isBarOwner?: boolean,
    venueData?: SignUpVenueData,
  ) => Promise<Awaited<ReturnType<typeof supabase.auth.signUp>>["data"]>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"]>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Single source of truth for auth state. Read it with the `useAuth` hook —
// never call useContext(AuthContext) directly, so the "outside the provider"
// guard in useAuth stays the only access path.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRoleAndStatus(user: User): Promise<{ role: "user" | "organizer" | "admin"; approvalStatus: ApprovalStatus }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();
  // A failed query must NOT be read as "this user has no elevated role" — that
  // would silently downgrade an admin/organizer to "user" and bounce them off
  // role-gated pages on a transient network blip. Throw so the caller retries.
  if (error) throw error;
  const r = data?.role;
  const rawStatus = data?.approval_status;
  const approvalStatus: ApprovalStatus =
    rawStatus === "pending" || rawStatus === "rejected" ? rawStatus : "approved";
  if (r === "organizer" || r === "admin") return { role: r, approvalStatus };
  // fallback to auth metadata (set during signup before email confirmation)
  const meta = user.user_metadata?.role;
  if (meta === "organizer" || meta === "admin") return { role: meta, approvalStatus };
  return { role: "user", approvalStatus };
}

// Resolve the role with a few short retries so a transient failure (Safari
// HTTP/2 stall, brief offline blip, token-refresh hiccup) doesn't get treated
// as a final answer. Without this, one failed profiles fetch was enough to
// bounce a working admin to the landing page.
async function fetchRoleWithRetry(
  user: User,
  attempts = 3,
): Promise<{ role: "user" | "organizer" | "admin"; approvalStatus: ApprovalStatus }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchRoleAndStatus(user);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 400 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// Provider that resolves auth ONCE for the whole app. Previously useAuth was a
// plain hook, so every component that called it kept its own state + its own
// onAuthStateChange subscription and re-resolved the role on each mount. That
// made `user`/`role` start null on every page (re)mount — which left auth-gated
// React Query reads disabled at mount, defeating their refetch-on-open and
// leaving stale lists after a back-navigation (see OrganizerDashboard). Holding
// the state here keeps it resolved across navigations and uses a single auth
// subscription for the whole tree.
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    role: null,
    roleResolved: false,
    approvalStatus: null,
  });

  useEffect(() => {
    let lastFetchedUserId: string | null = null;
    let lastSeenEmail: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        // Drop any user-scoped query data so a subsequent login on the same tab
        // starts from a clean cache. Today all user-scoped keys include userId
        // so cross-user leaks aren't possible, but this is structural defense
        // against future queries that forget to scope by userId.
        if (lastFetchedUserId !== null) queryClient.clear();
        lastFetchedUserId = null;
        lastSeenEmail = null;
        setState({ user: null, session: null, loading: false, role: null, roleResolved: true, approvalStatus: null });
        return;
      }
      const currentEmail = user.email ?? null;
      if (lastSeenEmail && currentEmail && currentEmail !== lastSeenEmail && lastFetchedUserId === user.id) {
        markEmailJustChanged();
      }
      lastSeenEmail = currentEmail;
      const metaRole = user.user_metadata?.role;
      const initialRole: "user" | "organizer" | "admin" =
        metaRole === "organizer" || metaRole === "admin" ? metaRole : "user";
      const sameUser = lastFetchedUserId === user.id;
      setState(prev => ({
        user,
        session,
        loading: false,
        role: prev.role ?? initialRole,
        roleResolved: sameUser ? prev.roleResolved : false,
        approvalStatus: prev.approvalStatus ?? "approved",
      }));
      if (sameUser) return;
      lastFetchedUserId = user.id;
      const fetchedForUserId = user.id;
      fetchRoleWithRetry(user)
        .then(({ role, approvalStatus }) => {
          if (lastFetchedUserId !== fetchedForUserId) return;
          setState(prev => ({ ...prev, role, approvalStatus, roleResolved: true }));
        })
        .catch((err) => {
          if (lastFetchedUserId !== fetchedForUserId) return;
          console.error("[useAuth] fetchRoleAndStatus failed after retries", err);
          // Keep whatever role we already had (don't clobber a cached admin with
          // the "user" fallback); just mark resolution done so guards stop
          // spinning. Retries above already cover the common transient blip.
          setState(prev => ({ ...prev, roleResolved: true }));
        });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signUp: AuthContextValue["signUp"] = async (
    email,
    password,
    name,
    isBarOwner = false,
    venueData,
  ) => {
    const isNewBarSubmission =
      isBarOwner && venueData && !("existingVenueId" in venueData);
    const isExistingBarClaim =
      isBarOwner && venueData && "existingVenueId" in venueData;

    const barSubmissionMeta = isNewBarSubmission
      ? {
          name: venueData.name,
          address: venueData.address,
          neighborhood: venueData.neighborhood || "",
          website: venueData.website || null,
          instagram: venueData.instagram || null,
          phone: venueData.phone || null,
        }
      : null;

    const venueClaimMeta = isExistingBarClaim
      ? {
          venue_id: venueData.existingVenueId,
          website: venueData.website || null,
          instagram: venueData.instagram || null,
          phone: venueData.phone || null,
        }
      : null;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: name,
          last_name: "",
          role: isBarOwner ? "organizer" : "user",
          bar_submission: barSubmissionMeta,
          venue_claim: venueClaimMeta,
        },
        emailRedirectTo: `${window.location.origin}`,
      },
    });
    if (error) throw error;
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }

    // No client-side writes needed — handle_new_user trigger creates the profile
    // plus pending_bar_submissions / pending_venue_claims based on user_metadata.
    // venue_owners is created at admin approve time, not signup.

    return data;
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Clear user-specific service-worker caches so the next signed-in user
    // doesn't see stale rows from the previous session.
    if (typeof caches !== "undefined") {
      await Promise.all([
        caches.delete("supabase-profiles"),
        caches.delete("supabase-user-interests"),
      ]);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const value: AuthContextValue = { ...state, signUp, signIn, signOut, resetPassword };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
