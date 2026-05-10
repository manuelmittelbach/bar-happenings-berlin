export interface BarlinEvent {
  id: string;
  parentId: string;
  title: string;
  venue: string;
  venueId: string;
  neighborhood: string;
  address: string;
  date: string;
  startTime: string;
  category: string;
  description: string;
  entryInfo: string;
  language: string;
  recurrence: string;
  url: string;
  image?: string;
  imagePosition: string;
  endTime?: string;
  doorsTime?: string;
  interestedCount: number;
  status?: string;
  createdBy?: string;
  isManual: boolean;
  canceledBy?: "organizer" | "admin" | null;
  // Editorial flags — populated only on rows from `events` (the live table).
  // events_archive doesn't carry these, so wrappers default isHighlight=false
  // and highlightPriority=0 for archived rows.
  isHighlight: boolean;
  editorNote?: string;
  highlightPriority: number;
  // ISO timestamp from the row's created_at column. Used to surface the
  // "Just added" badge on cards added in the last ~48h. Optional because
  // events_archive doesn't always carry it through cleanly.
  createdAt?: string;
}

export interface Venue {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  description: string;
  image: string;
  instagram?: string;
  website?: string;
  websiteEvents?: string;
  scrapeEnabled: boolean;
  lat: number;
  lng: number;
}

// Virtual status field — `status` is not stored anywhere. Real staging rows
// are always pending (reject deletes the row outright); "approved" is set by
// the admin-side adapter when wrapping a row from the `events` table.
export type StagedEventStatus = "pending" | "approved";
export type StagedEventStatusFilter = "pending" | "approved";
export type StagedEventScope = "scraped" | "manual" | "recurring" | "any";

export interface StagedEvent {
  id: string;
  // Real staging rows never have a parent (staging holds templates, not
  // occurrences). Set only by the admin adapter when it wraps a child of an
  // approved series whose parent has already been archived.
  parentId: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  doorsTime: string | null;
  category: string | null;
  language: string;
  description: string;
  entryInfo: string;
  sourceUrl: string | null;
  status: StagedEventStatus;
  scrapedAt: string;
  isManual: boolean;
  createdByAdmin: boolean;
  recurrence: string;
  recurrenceUntil: string | null;
  // When set, this staging row is a proposed update to an existing live event
  // (events.id). The Scraped tab renders an "update card" with a Diff button;
  // approving applies selected fields to the live event row instead of
  // creating a new one. Null for normal new-event staging rows.
  replacesEventId: string | null;
  // Only set on rows wrapped from `events` (filter='approved' in admin) via
  // eventToAdminStaged. Real staging rows don't track interest, so this is 0.
  interestedCount?: number;
  // Approved-only: future-only siblings of the same series, sorted ascending,
  // so the admin can expand the recurring card and act on each occurrence
  // individually (show / edit / cancel). The events table doesn't store
  // recurrence_until, so we can't derive these on the fly via
  // generateOccurrences — they come straight from sibling rows in
  // fetchApprovedEvents. Includes the current row itself.
  approvedSiblings?: { id: string; date: string }[];
}

export interface StagedEventEdits {
  title?: string;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  doorsTime?: string | null;
  category?: string | null;
  language?: string;
  description?: string;
  entryInfo?: string;
  sourceUrl?: string | null;
  venueId?: string;
  recurrence?: string;
  recurrenceUntil?: string | null;
}
