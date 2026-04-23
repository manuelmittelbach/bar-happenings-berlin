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
  price: string;
  entryInfo: string;
  language: string;
  recurrence: string;
  url: string;
  image?: string;
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
  lat: number;
  lng: number;
}
