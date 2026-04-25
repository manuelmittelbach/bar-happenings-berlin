import { useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: "user" | "organizer" | "admin" | null;
  roleResolved: boolean;
  approvalStatus: ApprovalStatus | null;
}

async function fetchRoleAndStatus(user: User): Promise<{ role: "user" | "organizer" | "admin"; approvalStatus: ApprovalStatus }> {
  const { data } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();
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

export function useAuth() {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        lastFetchedUserId = null;
        setState({ user: null, session: null, loading: false, role: null, roleResolved: true, approvalStatus: null });
        return;
      }
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
      fetchRoleAndStatus(user).then(({ role, approvalStatus }) =>
        setState(prev => ({ ...prev, role, approvalStatus, roleResolved: true })));
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    isBarOwner = false,
    venueData?:
      | { existingVenueId: string; website?: string; instagram?: string; phone?: string }
      | { name: string; address: string; neighborhood?: string; website?: string; instagram?: string; phone?: string }
  ) => {
    const isNewBarSubmission =
      isBarOwner && venueData && !("existingVenueId" in venueData);
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: isBarOwner ? "organizer" : "user",
          bar_submission: barSubmissionMeta,
        },
        emailRedirectTo: `${window.location.origin}`,
      },
    });
    if (error) throw error;
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }

    // Existing-bar path: link organizer to existing venue immediately.
    // (RLS off on venue_owners, so client insert works even without session.)
    if (data.user && isBarOwner && venueData && "existingVenueId" in venueData) {
      const updates: { website?: string; instagram?: string; phone?: string } = {};
      if (venueData.website) updates.website = venueData.website;
      if (venueData.instagram) updates.instagram = venueData.instagram;
      if (venueData.phone) updates.phone = venueData.phone;
      if (Object.keys(updates).length > 0) {
        await supabase.from("venues").update(updates).eq("id", venueData.existingVenueId);
      }
      await supabase.from("venue_owners").insert({
        user_id: data.user.id,
        venue_id: venueData.existingVenueId,
      });
    }

    // New-bar path: handled by handle_new_user trigger via user_metadata.bar_submission.
    // No client-side bars/venues/venue_owners writes — those wait for admin approve.

    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  return { ...state, signUp, signIn, signOut, resetPassword };
}
