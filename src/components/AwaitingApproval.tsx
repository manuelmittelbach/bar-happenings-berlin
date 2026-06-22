import { Clock3, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmailConfirmedBadge } from "@/components/EmailConfirmedBadge";

/* Shown to an organizer whose account isn't approved yet. The ProfileGate
 * renders this in place of any /profile page until an admin approves, so a
 * pending organizer can't reach the hub/dashboard. Carries the one-shot
 * "Email confirmed" badge for the freshly-confirmed landing. */
export function AwaitingApproval() {
  const { approvalStatus } = useAuth();
  const rejected = approvalStatus === "rejected";

  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
        <div className="flex justify-center">
          <EmailConfirmedBadge />
        </div>
        <div className="flex justify-center">
          {rejected ? (
            <XCircle className="h-10 w-10 text-accent" />
          ) : (
            <Clock3 className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <h1 className="heading-display text-2xl">
          {rejected ? "Application not approved" : "Awaiting admin approval"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {rejected
            ? "Your bar account application was not approved. If you think this is a mistake, please contact us."
            : "Thanks for signing up! An admin needs to review your bar details before you can publish events. You'll get access automatically as soon as your account is approved."}
        </p>
        {!rejected && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do this to protect you and the bar community — only real owners or staff should be able to publish events for a bar.
          </p>
        )}
      </div>
    </div>
  );
}
