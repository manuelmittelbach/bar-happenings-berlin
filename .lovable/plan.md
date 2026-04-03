

# Import Real Events from JSON into Barlin

## What changes

Replace all mock data in `src/data/mockData.ts` with the 40 real events from your JSON file. Update the data model, categories, neighborhoods, venues, and helper functions to match the new format.

## Key data differences to handle

Your JSON events have **multiple dates** per event (recurring events), while the current model has a single `date` field. This is the main structural change — each event needs to be "flattened" so that one event with 8 dates becomes 8 individual event entries (one per date), all sharing the same details. This way the date filters (Today, Tomorrow, This Week) work correctly.

Other differences:
- Your JSON has 8 categories vs the current 16 — categories and filters will be updated to match
- New fields: `price`, `url`, `recurrence`, `language`, `category_id` — will be added to the interface
- Removed fields: `endTime`, `summary`, `image`, `interestedCount`, `featured` — will use defaults or be removed
- Neighborhoods extracted dynamically from the data (includes "Mitte / Alexanderplatz", "Moabit", "Schöneberg", etc.)

## Plan

### 1. Update `BarlinEvent` interface and data model
- Add: `price`, `url`, `recurrence`, `categoryId`
- Make optional: `endTime`, `image`, `summary`, `interestedCount`, `featured`
- Keep `entryInfo` derived from `price` (free vs paid)

### 2. Replace mock data in `src/data/mockData.ts`
- Set `categories` to the 8 from your JSON: Comedy, Pub Quiz, Language Exchange, Social / Networking, Singles & Dating, DJ / Music Night, Live Music, Other
- Extract `neighborhoods` dynamically from events
- Generate `venues` array from unique venue names in the data, with approximate Berlin lat/lng coordinates for the map
- Flatten all 40 events × their dates into individual event entries (~200+ entries)
- Generate stable IDs per event-date combo (e.g., `EVT-001-2026-04-09`)

### 3. Update `EventDetailDialog`
- Display `price`, `recurrence`, and `url` (link to external site)
- Show all upcoming dates for the same event series
- Handle missing images gracefully (placeholder or colored background with category emoji)

### 4. Update `EventCard`
- Handle missing images (show category emoji on colored background instead)
- Display price info instead of `entryInfo`

### 5. Update `Index.tsx` filters
- Categories now match the 8 real categories
- Entry filter logic updated to detect "Free" from the price field

### 6. Update helper functions
- `getEventsForDate`, `getEventById`, etc. updated to work with new flattened structure

## Technical details

- The JSON will be copied into the project and processed at build time (static data in `mockData.ts`)
- Each recurring event flattened: `EVT-001` with 8 dates → 8 entries with IDs `EVT-001-0` through `EVT-001-7`, all sharing the same `parentId` for grouping
- Venue coordinates will be approximated by neighborhood center when exact address is vague
- Category colors from the JSON will be used for the emoji-background placeholders on cards without images

