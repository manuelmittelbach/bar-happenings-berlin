import { useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: "user" | "organizer" | "admin" | null;
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
    approvalStatus: null,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({ ...prev, user: session?.user ?? null, session, loading: false }));
      if (session?.user) {
        fetchRoleAndStatus(session.user).then(({ role, approvalStatus }) =>
          setState(prev => ({ ...prev, role, approvalStatus })));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session,
        loading: false,
        role: session ? prev.role : null,
        approvalStatus: session ? prev.approvalStatus : null,
      }));
      if (session?.user) {
        fetchRoleAndStatus(session.user).then(({ role, approvalStatus }) =>
          setState(prev => ({ ...prev, role, approvalStatus })));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    isBarOwner = false,
    venueData?: { name: string; address: string; neighborhood: string; website?: string; instagram?: string; phone?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, role: isBarOwner ? "organizer" : "user" },
        emailRedirectTo: `${window.location.origin}`,
      },
    });
    if (error) throw error;
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }

    if (data.user) {
      await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          role: isBarOwner ? "organizer" : "user",
          approval_status: isBarOwner ? "pending" : "approved",
        })
        .eq("id", data.user.id);

      if (isBarOwner && venueData) {
        const venueId = crypto.randomUUID();
        const { error: venueError } = await supabase.from("venues").insert({
          id: venueId,
          name: venueData.name,
          address: venueData.address,
          neighborhood: venueData.neighborhood,
          website: venueData.website || null,
          instagram: venueData.instagram || null,
          phone: venueData.phone || null,
          lat: 0,
          lng: 0,
        });
        if (!venueError) {
          await supabase.from("venue_owners").insert({
            user_id: data.user.id,
            venue_id: venueId,
          });
        }
      }
    }

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
