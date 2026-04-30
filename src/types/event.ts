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
  online: "yes" | "no";
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
