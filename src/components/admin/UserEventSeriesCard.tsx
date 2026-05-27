import { type ReactNode } from "react";
import { Repeat, ChevronDown } from "lucide-react";
import { formatDateWithDay } from "@/lib/dateFormat";
import { formatRecurrenceLabel } from "@/lib/recurrence";
import { isEventInPast } from "@/lib/eventStatus";
import type { BarlinEvent } from "@/types/event";

interface UserEventSeriesCardProps {
  /** Series parent — carries the recurrence + the series-level fields shown. */
  head: BarlinEvent;
  /** Every occurrence, sorted ascending; rendered in the expanded date list. */
  members: BarlinEvent[];
  count: number;
  /** Next upcoming occurrence (or earliest if all past) — drives the headline. */
  next: BarlinEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Right-column action buttons (Approve/Reject, or Edit/Delete). */
  actions?: ReactNode;
  /** Footer rendered below the card body (e.g. the manual-venue decision panel). */
  children?: ReactNode;
}

/** Shared moderation card for a user-submitted event series, reused by the
 *  pending and accepted tabs. Renders the cover, title + recurrence badge,
 *  "Next:" headline, venue/address, submitter, a preview link and an
 *  expandable per-occurrence date list. The tab-specific actions and footer
 *  come in through the `actions` and `children` slots. */
export default function UserEventSeriesCard({
  head,
  members,
  count,
  next,
  isExpanded,
  onToggleExpand,
  actions,
  children,
}: UserEventSeriesCardProps) {
  const recurrenceLabel = formatRecurrenceLabel(head.recurrence);
  const canExpand = count > 1;

  return (
    <div className="border-2 border-foreground p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {head.image && (
          <div className="w-full sm:w-24 h-20 flex-shrink-0 overflow-hidden bg-muted border-2 border-foreground">
            <img
              src={head.image}
              alt={head.title}
              style={{ objectPosition: head.imagePosition }}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="font-serif text-base font-bold leading-tight break-words min-w-0">{head.title}</p>
            {recurrenceLabel && (
              <span className="inline-flex items-center gap-1 border border-foreground/30 bg-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Repeat className="h-3 w-3" /> {recurrenceLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {head.venue || "—"}{head.neighborhood ? ` · ${head.neighborhood}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {recurrenceLabel ? "Next: " : ""}{formatDateWithDay(next.date)}{next.startTime ? ` · ${next.startTime}` : ""}
          </p>
          {head.address && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{head.address}</p>
          )}
          {/* Who submitted it — so admins can identify / contact the plain user. */}
          {head.submitter && (
            <p className="text-xs text-muted-foreground mt-1.5 break-words">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Submitted by</span>{" "}
              {[head.submitter.firstName, head.submitter.lastName].filter(Boolean).join(" ") &&
                `${[head.submitter.firstName, head.submitter.lastName].filter(Boolean).join(" ")} · `}
              {head.submitter.email ? (
                <a href={`mailto:${head.submitter.email}`} className="underline hover:text-foreground">
                  {head.submitter.email}
                </a>
              ) : "—"}
            </p>
          )}
          {/* Live detail page preview, pointed at the next occurrence to match
              the headline (admins can read pending rows via RLS). */}
          <div className="mt-2 flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => window.open(`/event/${next.id}`, "_blank", "noopener")}
              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Preview ↗
            </button>
            {canExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                {isExpanded ? "Hide dates" : `All ${count} dates`}
              </button>
            )}
          </div>
        </div>
        {actions}
      </div>

      {/* Every occurrence of a recurring series, so the admin can review the
          full set. Each date links to its own detail page. */}
      {canExpand && isExpanded && (
        <div className="mt-3 pt-2 border-t border-foreground/15 divide-y divide-foreground/10">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className={`text-muted-foreground ${isEventInPast(m) ? "line-through opacity-60" : ""}`}>
                {formatDateWithDay(m.date)}{m.startTime ? ` · ${m.startTime}` : ""}
              </span>
              <button
                type="button"
                onClick={() => window.open(`/event/${m.id}`, "_blank", "noopener")}
                className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent hover:underline flex-shrink-0"
              >
                Preview ↗
              </button>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
