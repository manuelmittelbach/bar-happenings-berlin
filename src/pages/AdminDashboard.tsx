import { useState, useEffect, useCallback } from "react";
import { formatDateShort } from "@/lib/dateFormat";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, Building2, Shield, Globe, Instagram, Phone, Edit } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPendingOrganizers,
  fetchDecidedOrganizers,
  fetchVenuesWithOwnership,
  updateOrganizerApprovalStatus,
  approveOrganizerWithNewBar,
  type OrganizerAccount,
} from "@/lib/supabaseQueries";
import type { Venue } from "@/types/event";

type BarTab = "pending" | "overview" | "all-bars";

export default function AdminDashboard() {
  const { user, role, loading, roleResolved } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeBarTab: BarTab =
    tabParam === "overview" ? "overview" : tabParam === "all-bars" ? "all-bars" : "pending";
  const setActiveBarTab = (tab: BarTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "pending") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next);
  };

  const [pendingOrganizers, setPendingOrganizers] = useState<OrganizerAccount[]>([]);
  const [pendingOrganizersLoading, setPendingOrganizersLoading] = useState(true);
  const [decidedOrganizers, setDecidedOrganizers] = useState<OrganizerAccount[]>([]);
  const [decidedOrganizersLoading, setDecidedOrganizersLoading] = useState(true);
  const [allBars, setAllBars] = useState<{ venue: Venue; hasOwner: boolean }[]>([]);
  const [allBarsLoading, setAllBarsLoading] = useState(true);
  const [allBarsQuery, setAllBarsQuery] = useState("");

  useEffect(() => {
    if (!loading && roleResolved && role !== "admin") navigate("/", { replace: true });
  }, [role, roleResolved, loading, navigate]);

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

  const loadAllBars = useCallback(async () => {
    setAllBarsLoading(true);
    try {
      setAllBars(await fetchVenuesWithOwnership());
    } catch {
      toast.error("Failed to load bars.");
    } finally {
      setAllBarsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingOrganizers();
    loadDecidedOrganizers();
    loadAllBars();
  }, [loadPendingOrganizers, loadDecidedOrganizers, loadAllBars]);

  const handleApproveOrganizer = async (organizer: OrganizerAccount) => {
    if (!user) return;
    try {
      const label = organizer.venue?.name ?? organizer.pendingSubmission?.name ?? organizer.email ?? "Bar";
      let approvedVenue: OrganizerAccount["venue"] = organizer.venue;
      if (organizer.pendingSubmission && !organizer.venue) {
        await approveOrganizerWithNewBar(organizer.id, user.id, organizer.pendingSubmission);
        approvedVenue = {
          id: "",
          name: organizer.pendingSubmission.name,
          address: organizer.pendingSubmission.address,
          neighborhood: organizer.pendingSubmission.neighborhood,
          website: organizer.pendingSubmission.website,
          instagram: organizer.pendingSubmission.instagram,
          phone: organizer.pendingSubmission.phone,
        };
        loadAllBars();
      } else {
        await updateOrganizerApprovalStatus(organizer.id, "approved", user.id);
      }
      toast.success(`${label} approved`);
      setPendingOrganizers(prev => prev.filter(o => o.id !== organizer.id));
      const decided: OrganizerAccount = {
        ...organizer,
        approvalStatus: "approved",
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        venue: approvedVenue,
        pendingSubmission: null,
      };
      setDecidedOrganizers(prev => [decided, ...prev]);
    } catch {
      toast.error("Failed to approve bar account.");
    }
  };

  const handleRejectOrganizer = async (organizer: OrganizerAccount) => {
    try {
      await updateOrganizerApprovalStatus(organizer.id, "rejected");
      const label = organizer.venue?.name ?? organizer.pendingSubmission?.name ?? organizer.email ?? "Bar";
      toast.error(`${label} rejected`);
      setPendingOrganizers(prev => prev.filter(o => o.id !== organizer.id));
      const decided: OrganizerAccount = {
        ...organizer,
        approvalStatus: "rejected",
        approvedBy: null,
        approvedAt: null,
        pendingSubmission: null,
      };
      setDecidedOrganizers(prev => [decided, ...prev]);
    } catch {
      toast.error("Failed to reject bar account.");
    }
  };

  if (loading || !roleResolved) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }
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
              {pendingOrganizersLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="font-heading text-2xl font-bold">{String(pendingOrganizers.length)}</p>
              )}
            </div>
            <div className="border border-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Total Decided</span>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              {decidedOrganizersLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="font-heading text-2xl font-bold">{String(decidedOrganizers.length)}</p>
              )}
            </div>
          </div>

          {/* Bar Accounts sub-tabs */}
          <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto">
            {(["overview", "pending", "all-bars"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveBarTab(tab)}
                className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeBarTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "pending"
                  ? pendingOrganizersLoading ? "Pending" : `Pending (${pendingOrganizers.length})`
                  : tab === "overview"
                  ? decidedOrganizersLoading ? "Overview" : `Overview (${decidedOrganizers.length})`
                  : allBarsLoading ? "All Bars" : `All Bars (${allBars.length})`}
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
                  returnPath="/admin"
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
                <OrganizerCard key={organizer.id} organizer={organizer} returnPath="/admin?tab=overview" />
              ))}
            </div>
          )}

          {activeBarTab === "all-bars" && (
            <div className="space-y-3">
              {allBarsLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!allBarsLoading && (
                <>
                  <input
                    type="search"
                    value={allBarsQuery}
                    onChange={(e) => setAllBarsQuery(e.target.value)}
                    placeholder="Search by name, address or neighborhood…"
                    className="w-full h-10 px-3 mb-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                  />
                  {(() => {
                    const q = allBarsQuery.trim().toLowerCase();
                    const filtered = q
                      ? allBars.filter(({ venue }) =>
                          venue.name.toLowerCase().includes(q) ||
                          venue.address.toLowerCase().includes(q) ||
                          venue.neighborhood.toLowerCase().includes(q),
                        )
                      : allBars;
                    if (filtered.length === 0) {
                      return <p className="text-sm text-muted-foreground">No bars match your search.</p>;
                    }
                    return filtered.map(({ venue, hasOwner }) => (
                      <BarCard key={venue.id} venue={venue} hasOwner={hasOwner} />
                    ));
                  })()}
                </>
              )}
            </div>
          )}
    </div>
  );
}

function BarCard({ venue, hasOwner }: { venue: Venue; hasOwner: boolean }) {
  return (
    <div className="border border-border rounded-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading text-sm font-semibold">{venue.name}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
              hasOwner ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
            }`}
          >
            {hasOwner ? "Claimed" : "Unclaimed"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {venue.neighborhood || "(no neighborhood)"}
          {venue.address ? ` · ${venue.address}` : ""}
        </p>
        {(venue.website || venue.instagram) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-3 w-3" /> {venue.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {venue.instagram && (
              <a
                href={
                  /^https?:\/\//i.test(venue.instagram)
                    ? venue.instagram
                    : `https://instagram.com/${venue.instagram.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Instagram className="h-3 w-3" /> {venue.instagram.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OrganizerCard({
  organizer,
  onApprove,
  onReject,
  returnPath,
}: {
  organizer: OrganizerAccount;
  onApprove?: () => void;
  onReject?: () => void;
  returnPath: string;
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

  // Display unifies venue (claimed) and pendingSubmission (awaiting approve) — admin sees the same fields either way.
  const display = organizer.venue
    ? {
        name: organizer.venue.name,
        address: organizer.venue.address,
        neighborhood: organizer.venue.neighborhood,
        website: organizer.venue.website,
        instagram: organizer.venue.instagram,
        phone: organizer.venue.phone,
      }
    : organizer.pendingSubmission
    ? {
        name: organizer.pendingSubmission.name,
        address: organizer.pendingSubmission.address,
        neighborhood: organizer.pendingSubmission.neighborhood,
        website: organizer.pendingSubmission.website,
        instagram: organizer.pendingSubmission.instagram,
        phone: organizer.pendingSubmission.phone,
      }
    : null;
  const isSubmittedBar = !organizer.venue && !!organizer.pendingSubmission;

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading text-sm font-semibold">{display?.name ?? "(no venue)"}</p>
          {isSubmittedBar && (
            <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-blue-500/10 text-blue-600">
              Submitted bar
            </span>
          )}
          {organizer.approvalStatus !== "pending" && (
            <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${statusPill}`}>
              {organizer.approvalStatus}
            </span>
          )}
        </div>
        {display && (
          <p className="text-xs text-muted-foreground">
            {display.neighborhood}
            {display.address ? ` · ${display.address}` : ""}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {fullName || "(no name)"}
          {organizer.email ? ` · ${organizer.email}` : ""}
        </p>
        {display && (display.website || display.instagram || display.phone) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {display.website && (
              <a
                href={display.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-3 w-3" /> {display.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {display.instagram && (
              <a
                href={
                  /^https?:\/\//i.test(display.instagram)
                    ? display.instagram
                    : `https://instagram.com/${display.instagram.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Instagram className="h-3 w-3" /> {display.instagram.replace(/^https?:\/\//, "")}
              </a>
            )}
            {display.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {display.phone}
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
        {(organizer.venue || organizer.pendingSubmission) && (
          <Link
            to={`/admin/bar-account/${organizer.id}`}
            state={{ returnPath }}
            className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
            title="Edit"
          >
            <Edit className="h-3 w-3" /> Edit
          </Link>
        )}
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
