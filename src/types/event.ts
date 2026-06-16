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
  // True when this event came through the plain-user submission pipeline.
  // Drives the "Community submission" badge on cards + detail. Bar-owner
  // and admin events stay false. Only present on rows from `events` (the
  // live table); events_archive doesn't carry the flag, so archived rows
  // surface as false via the mapper.
  isCommunitySubmission: boolean;
  // Who submitted this event, resolved from profiles via created_by. Only
  // populated for the admin moderation queue (fetchPendingUserSubmissions) so
  // admins see the plain user behind a pending submission. Email always present
  // for a real account; name parts may be empty if the user never set them.
  submitter?: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface Venue {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  description: string;
  image: string;
  imagePosition?: string;
  // Per-source archives, populated by the og/google scrapers. Independent
  // of `image` (which points to whichever source is currently active).
  // Admin UI uses these for the source-swap toggle on BarDetail.
  imageOg?: string;
  imageGoogle?: string;
  instagram?: string;
  telegram?: string;
  website?: string;
  websiteEvents?: string;
  phone?: string;
  scrapeEnabled: boolean;
  instagramScrapeEnabled: boolean;
  telegramScrapeEnabled: boolean;
  isVisible: boolean;
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
  // Why a scraper staged THIS as an empty placeholder (no event found). Fixed
  // code (no_events / unreachable / blocked / unparseable) driving a badge in
  // the admin Manual Events tab; null for real staged events. `placeholderNote`
  // is an optional free-text detail set by the scraper.
  placeholderReason: string | null;
  placeholderNote: string | null;
  createdByAdmin: boolean;
  recurrence: string;
  recurrenceUntil: string | null;
  // When set, this staging row is a proposed update to an existing live event
  // (events.id). The Scraped tab renders an "update card" with a Diff button;
  // approving applies selected fields to the live event row instead of
  // creating a new one. Null for normal new-event staging rows.
  replacesEventId: string | null;
  // Submitter (auth uid) for plain-user submissions; null for scraper/admin
  // rows. Preserved into events.created_by on approve so the approved view can
  // still resolve the original submitter.
  createdBy: string | null;
  // Resolved submitter contact (from profiles via createdBy), shown on the
  // admin "User events" card so the moderator sees who to follow up with. Only
  // populated for user submissions; undefined for scraper/admin rows.
  submitter?: {
    email: string;
    firstName: string;
    lastName: string;
  };
  // User-supplied cover image + framing, carried into the events row on
  // approve. Null/undefined for scraper rows (admins add covers post-approve).
  image?: string | null;
  imagePosition?: string;
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
