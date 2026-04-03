

# Update Events Data from New JSON

## What changes

Replace all events, venues, neighborhoods, and categories in `src/data/mockData.ts` with the new JSON data (48 event entries across 10 unique events).

## New data summary

- **10 unique events** (recurring), flattened into ~48 individual entries
- **New categories**: Comedy, Open Mic, Live Music, Quiz Night, Promo / Date Night — replaces the previous 8 categories
- **New neighborhoods**: Charlottenburg, Neukölln, Mitte, Prenzlauer Berg (+ some empty)
- **New venues**: Monkey Bar, Ratzeputz Bar, Donau115, Z Bar, Honey Lou Bar, Tipsy Bear, The Castle Berlin, The Social Hub Berlin

## Plan

### 1. Update `src/data/mockData.ts`

- Update `categoryInfos` to the 5 new categories: Comedy, Open Mic, Live Music, Quiz Night, Promo / Date Night — with appropriate IDs, emojis, and colors
- Update `neighborhoods` array from the new data
- Update `venues` array with the 8 new venues and approximate lat/lng
- Replace all events with the 48 new flattened entries, using stable IDs and `parentId` grouping for recurring events

### 2. Update `src/assets/categories/index.ts`

- Add mappings for new category IDs (`open-mic`, `quiz-night`, `promo-date-night`)
- Map them to existing images where similar (e.g., `quiz-night` → `pub-quiz` image, `open-mic` → `comedy` image, `promo-date-night` → `singles` or `social` image)

### 3. No other file changes needed

The existing Index.tsx, EventCard, EventDetailDialog all use the data model generically — categories, filters, and date sections will auto-update.

## Technical details

- Each recurring event gets a shared `parentId` (e.g., `monkey-bar-date-night`) so only the soonest occurrence shows in "All" view
- Events with empty addresses or neighborhoods will use the venue name / neighborhood as fallback
- Price field extracted from description where mentioned (e.g., "€5 per player", "Free admission")

