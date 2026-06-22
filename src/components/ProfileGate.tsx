import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner } from "@/components/ui/page-spinner";
import { AwaitingApproval } from "@/components/AwaitingApproval";

/* Wraps the signed-in /profile routes. A pending (or rejected) organizer can't
 * reach any of them — every profile URL renders the AwaitingApproval screen
 * until an admin approves. Everyone else (plain users, admins, approved
 * organizers) passes through to the requested page. */
export function ProfileGate() {
  const { user, role, approvalStatus, loading, roleResolved } = useAuth();

  // Hold until the role is authoritative — otherwise an admin/organizer is
  // briefly seen as a plain "user" and would slip past (or get wrongly gated).
  if (loading || !roleResolved) return <PageSpinner />;
  if (!user) return <Navigate to="/signin" replace />;

  if (role === "organizer" && approvalStatus !== "approved") {
    return <AwaitingApproval />;
  }

  return <Outlet />;
}
