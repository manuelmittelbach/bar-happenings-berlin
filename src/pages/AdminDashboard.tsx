import { useState, useEffect, useCallback } from "react";
import { formatDateShort } from "@/lib/dateFormat";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, Building2, Shield, Globe, Instagram, Phone, Edit } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchPendingOrganizers,
  fetchDecidedOrganizers,
  updateOrganizerApprovalStatus,
  type OrganizerAccount,
} from "@/lib/supabaseQueries";

type BarTab = "pending" | "overview";

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBarTab: BarTab = searchParams.get("tab") === "overview" ? "overview" : "pending";
  const setActiveBarTab = (tab: BarTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") next.set("tab", "overview");
    else next.delete("tab");
    setSearchParams(next);
  };

  const [pendingOrganizers, setPendingOrganizers] = useState<OrganizerAccount[]>([]);
  const [pendingOrganizersLoading, setPendingOrganizersLoading] = useState(true);
  const [decidedOrganizers, setDecidedOrganizers] = useState<OrganizerAccount[]>([]);
  const [decidedOrganizersLoading, setDecidedOrganizersLoading] = useState(true);

  useEffect(() => {
    if (!loading && role !== null && role !== "admin") navigate("/", { replace: true });
  }, [role, loading, navigate]);

  const loadPendingOrganizers = useCallback(async () => {
    setPendingOrganizersLoading(true);
    try {
      setPendingOrganizers(await fetchPendingOrganizers());
    } catch {
      toast.error("Failed to load pending bar accounts.");
    } finally {
      setPendingOrganizersLoading(false);
    }
  }, []);

  const loadDecidedOrganizers = useCallback(async () => {
    setDecidedOrganizersLoading(true);
    try {
      setDecidedOrganizers(await fetchDecidedOrganizers());
    } catch {
      toast.error("Failed to load bar accounts overview.");
    } finally {
      setDecidedOrganizersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingOrganizers();
    loadDecidedOrganizers();
  }, [loadPendingOrganizers, loadDecidedOrganizers]);

  const handleApproveOrganizer = async (organizer: OrganizerAccount) => {
    if (!user) return;
    try {
      await updateOrganizerApprovalStatus(organizer.id, "approved", user.id);
      toast.success(`${organizer.venue?.name ?? organizer.email ?? "Bar"} approved`);
      setPendingOrganizers(prev => prev.filter(o => o.id !== organizer.id));
      const decided: OrganizerAccount = {
        ...organizer,
        approvalStatus: "approved",
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
      };
      setDecidedOrganizers(prev => [decided, ...prev]);
    } catch {
      toast.error("Failed to approve bar account.");
    }
  };

  const handleRejectOrganizer = async (organizer: OrganizerAccount) => {
    try {
      await updateOrganizerApprovalStatus(organizer.id, "rejected");
      toast.error(`${organizer.venue?.name ?? organizer.email ?? "Bar"} rejected`);
      setPendingOrganizers(prev => prev.filter(o => o.id !== organizer.id));
      const decided: OrganizerAccount = {
        ...organizer,
        approvalStatus: "rejected",
        approvedBy: null,
        approvedAt: null,
      };
      setDecidedOrganizers(prev => [decided, ...prev]);
    } catch {
      toast.error("Failed to reject bar account.");
    }
  };

  if (loading || role === null) return null;
  if (role !== "admin") return null;

  return (
    <div className="container py-8">
          <div className="flex items-center gap-2 mb-8">
            <Shield className="h-5 w-5 text-accent" />
            <h1 className="heading-display text-3xl">Admin Dashboard</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-md">
            <div className="border border-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Pending Bars</span>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="font-heading text-2xl font-bold">{String(pendingOrganizers.length)}</p>
            </div>
            <div className="border border-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Total Decided</span>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="font-heading text-2xl font-bold">{String(decidedOrganizers.length)}</p>
            </div>
          </div>

          {/* Bar Accounts sub-tabs */}
          <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto">
            {(["overview", "pending"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveBarTab(tab)}
                className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeBarTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "pending" ? `Pending (${pendingOrganizers.length})` : `Overview (${decidedOrganizers.length})`}
              </button>
            ))}
          </div>

          {activeBarTab === "pending" && (
            <div className="space-y-3">
              {pendingOrganizersLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!pendingOrganizersLoading && pendingOrganizers.length === 0 && (
                <p className="text-sm text-muted-foreground">No bar accounts pending review.</p>
              )}
              {pendingOrganizers.map((organizer) => (
                <OrganizerCard
                  key={organizer.id}
                  organizer={organizer}
                  onApprove={() => handleApproveOrganizer(organizer)}
                  onReject={() => handleRejectOrganizer(organizer)}
                />
              ))}
            </div>
          )}

          {activeBarTab === "overview" && (
            <div className="space-y-3">
              {decidedOrganizersLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!decidedOrganizersLoading && decidedOrganizers.length === 0 && (
                <p className="text-sm text-muted-foreground">No bar accounts approved or rejected yet.</p>
              )}
              {decidedOrganizers.map((organizer) => (
                <OrganizerCard key={organizer.id} organizer={organizer} />
              ))}
            </div>
          )}
    </div>
  );
}

function OrganizerCard({
  organizer,
  onApprove,
  onReject,
}: {
  organizer: OrganizerAccount;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const fullName = `${organizer.firstName} ${organizer.lastName}`.trim();
  const submitted = organizer.createdAt ? formatDateShort(organizer.createdAt.split("T")[0]) : null;
  const decided = organizer.approvedAt ? formatDateShort(organizer.approvedAt.split("T")[0]) : null;
  const statusPill =
    organizer.approvalStatus === "approved"
      ? "bg-green-500/10 text-green-600"
      : organizer.approvalStatus === "rejected"
      ? "bg-red-500/10 text-red-600"
      : "bg-yellow-500/10 text-yellow-600";

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading text-sm font-semibold">{organizer.venue?.name ?? "(no venue)"}</p>
          {organizer.approvalStatus !== "pending" && (
            <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${statusPill}`}>
              {organizer.approvalStatus}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {organizer.venue?.neighborhood}
          {organizer.venue?.address ? ` · ${organizer.venue.address}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {fullName || "(no name)"}
          {organizer.email ? ` · ${organizer.email}` : ""}
        </p>
        {(organizer.venue?.website || organizer.venue?.instagram || organizer.venue?.phone) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {organizer.venue?.website && (
              <a
                href={organizer.venue.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-3 w-3" /> {organizer.venue.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {organizer.venue?.instagram && (
              <span className="inline-flex items-center gap-1">
                <Instagram className="h-3 w-3" /> {organizer.venue.instagram}
              </span>
            )}
            {organizer.venue?.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {organizer.venue.phone}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {submitted && <>Submitted {submitted}</>}
          {decided && organizer.approvalStatus === "approved" && <> · Approved {decided}</>}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Link
          to={`/admin/bar-account/${organizer.id}`}
          className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
          title="Edit"
        >
          <Edit className="h-3 w-3" /> Edit
        </Link>
        {onApprove && (
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1 h-8 px-3 bg-foreground text-background rounded-sm text-xs font-medium"
          >
            <Check className="h-3 w-3" /> Approve
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
          >
            <X className="h-3 w-3" /> Reject
          </button>
        )}
      </div>
    </div>
  );
}
