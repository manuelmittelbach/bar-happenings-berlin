
-- Categories table
CREATE TABLE public.categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable" ON public.categories
  FOR SELECT USING (true);

-- Venues table
CREATE TABLE public.venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  instagram TEXT,
  website TEXT,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues are publicly readable" ON public.venues
  FOR SELECT USING (true);

-- Events table
CREATE TABLE public.events (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  venue_id TEXT NOT NULL REFERENCES public.venues(id),
  venue TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  category TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.categories(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  entry_info TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  recurrence TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image TEXT,
  summary TEXT,
  interested_count INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly readable" ON public.events
  FOR SELECT USING (true);
