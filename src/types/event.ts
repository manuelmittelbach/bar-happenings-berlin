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
  categoryId: string;
  tags: string[];
  description: string;
  entryInfo: string;
  language: string;
  recurrence: string;
  url: string;
  image?: string;
  imagePosition: string;
  endTime?: string;
  summary?: string;
  interestedCount?: number;
  featured?: boolean;
  status?: string;
  createdBy?: string;
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

export type StagedEventStatus = "pending" | "approved" | "rejected";
export type StagedEventFilter = StagedEventStatus | "all" | "manual";

export interface StagedEvent {
  id: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string | null;
  language: string;
  description: string;
  entryInfo: string;
  sourceUrl: string | null;
  status: StagedEventStatus;
  scrapedAt: string;
  reviewedAt: string | null;
  isManual: boolean;
}

export interface StagedEventEdits {
  title?: string;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  category?: string | null;
  language?: string;
  description?: string;
  entryInfo?: string;
}
