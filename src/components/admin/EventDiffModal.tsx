import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { applyEventUpdate, deleteStagedEvent, type EventUpdatePatch } from "@/lib/supabaseQueries";
import type { StagedEvent, BarlinEvent } from "@/types/event";
import { toast } from "sonner";

// Field metadata for the diff. The first 8 are "applyable" — they map to
// columns the patch helper writes. category and language are intentionally
// listed so the admin can SEE that they differ, but a checkbox isn't shown
// because the auto-pipeline considers them admin-curated noise.
type FieldKey =
  | "title"
  | "date"
  | "startTime"
  | "endTime"
  | "doorsTime"
  | "description"
  | "entryInfo"
  | "sourceUrl"
  | "category"
  | "language";

const APPLYABLE_FIELDS: FieldKey[] = [
  "title",
  "date",
  "startTime",
  "endTime",
  "doorsTime",
  "description",
  "entryInfo",
  "sourceUrl",
];

const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Title",
  date: "Date",
  startTime: "Start time",
  endTime: "End time",
  doorsTime: "Doors time",
  description: "Description",
  entryInfo: "Price",
  sourceUrl: "Source URL",
  category: "Category",
  language: "Language",
};

function getLive(event: BarlinEvent, key: FieldKey): string {
  switch (key) {
    case "title": return event.title;
    case "date": return event.date;
    case "startTime": return event.startTime ?? "";
    case "endTime": return event.endTime ?? "";
    case "doorsTime": return event.doorsTime ?? "";
    case "description": return event.description ?? "";
    case "entryInfo": return event.entryInfo ?? "";
    case "sourceUrl": return event.url ?? "";
    case "category": return event.category;
    case "language": return event.language ?? "";
  }
}

function getStaged(event: StagedEvent, key: FieldKey): string {
  switch (key) {
    case "title": return event.title;
    case "date": return event.date;
    case "startTime": return event.startTime ?? "";
    case "endTime": return event.endTime ?? "";
    case "doorsTime": return event.doorsTime ?? "";
    case "description": return event.description;
    case "entryInfo": return event.entryInfo;
    case "sourceUrl": return event.sourceUrl ?? "";
    case "category": return event.category ?? "";
    case "language": return event.language;
  }
}

// Same normalization as the Python compare. Whitespace-only / null vs ""
// must compare equal so the modal doesn't render phantom diffs.
function normalize(key: FieldKey, value: string): string {
  const v = value.trim();
  if (key === "description") return v.replace(/\s+/g, " ");
  if (key === "sourceUrl") return v.toLowerCase();
  return v;
}

export interface EventDiffModalProps {
  stagedEvent: StagedEvent;
  liveEvent: BarlinEvent;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
  onSwitchToManualEdit: () => void;
}

export default function EventDiffModal({
  stagedEvent,
  liveEvent,
  open,
  onClose,
  onApplied,
  onSwitchToManualEdit,
}: EventDiffModalProps) {
  const allFields: FieldKey[] = [
    "title", "date", "startTime", "endTime", "doorsTime",
    "description", "entryInfo", "sourceUrl", "category", "language",
  ];

  const divergingFields = useMemo(() => {
    return allFields.filter((key) => {
      const live = normalize(key, getLive(liveEvent, key));
      const scraped = normalize(key, getStaged(stagedEvent, key));
      return live !== scraped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedEvent, liveEvent]);

  // Default: all applyable diverging fields ticked. Admin can untick the
  // ones they don't want.
  const [selected, setSelected] = useState<Set<FieldKey>>(() => {
    return new Set(divergingFields.filter((k) => APPLYABLE_FIELDS.includes(k)));
  });
  const [submitting, setSubmitting] = useState(false);

  const toggle = (key: FieldKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    setSubmitting(true);
    try {
      const patch: EventUpdatePatch = {};
      if (selected.has("title")) patch.title = stagedEvent.title;
      if (selected.has("date")) patch.date = stagedEvent.date;
      if (selected.has("startTime")) patch.startTime = stagedEvent.startTime;
      if (selected.has("endTime")) patch.endTime = stagedEvent.endTime;
      if (selected.has("doorsTime")) patch.doorsTime = stagedEvent.doorsTime;
      if (selected.has("description")) patch.description = stagedEvent.description;
      if (selected.has("entryInfo")) patch.entryInfo = stagedEvent.entryInfo;
      if (selected.has("sourceUrl")) patch.sourceUrl = stagedEvent.sourceUrl;
      await applyEventUpdate(liveEvent.id, patch, stagedEvent.id);
      toast.success(`${selected.size} field(s) applied`);
      onApplied();
    } catch (e) {
      toast.error(`Apply failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await deleteStagedEvent(stagedEvent.id);
      toast.info("Update rejected — staging row deleted");
      onApplied();
    } catch (e) {
      toast.error(`Reject failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const applyableCount = divergingFields.filter((k) => APPLYABLE_FIELDS.includes(k)).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Update for live event</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {liveEvent.title} — {liveEvent.date}
            </p>
          </div>

          {divergingFields.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No diverging fields detected. The staging row may be stale —
              consider rejecting.
            </p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {divergingFields.map((key) => {
                const isApplyable = APPLYABLE_FIELDS.includes(key);
                const checked = selected.has(key);
                return (
                  <div
                    key={key}
                    className={`border border-border rounded-sm p-3 ${
                      isApplyable ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {isApplyable ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(key)}
                          disabled={submitting}
                          className="mt-0.5 cursor-pointer"
                          id={`diff-${key}`}
                        />
                      ) : (
                        <div className="w-4 h-4 mt-0.5" />
                      )}
                      <label
                        htmlFor={isApplyable ? `diff-${key}` : undefined}
                        className="text-xs font-mono uppercase tracking-wider font-bold cursor-pointer"
                      >
                        {FIELD_LABELS[key]}
                        {!isApplyable && (
                          <span className="ml-2 text-muted-foreground normal-case font-normal">
                            (display only — not auto-applied)
                          </span>
                        )}
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm pl-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Live (current)</div>
                        <div className="bg-muted/40 border border-border rounded-sm px-2 py-1.5 break-words whitespace-pre-wrap">
                          {getLive(liveEvent, key) || <span className="italic text-muted-foreground">empty</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scraped (new)</div>
                        <div className="bg-muted/40 border border-border rounded-sm px-2 py-1.5 break-words whitespace-pre-wrap">
                          {getStaged(stagedEvent, key) || <span className="italic text-muted-foreground">empty</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
            <button
              onClick={onSwitchToManualEdit}
              disabled={submitting}
              className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted disabled:opacity-50"
            >
              Manuell editieren
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={handleApply}
              disabled={submitting || selected.size === 0}
              className="h-9 px-3 text-sm bg-foreground text-background rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Applying..." : `Apply ${selected.size} of ${applyableCount}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
