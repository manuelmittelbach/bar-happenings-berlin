import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthProvider";

// Auth is resolved once by <AuthProvider> at the app root (see AuthProvider.tsx)
// and shared through context. This hook just reads that shared state, so `user`/
// `role` stay resolved across page navigations instead of re-resolving (and
// briefly going null) on every component mount.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
