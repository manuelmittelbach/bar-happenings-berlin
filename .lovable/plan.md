

# Import New Events from JSON

## What changes
Add ~146 new event entries from the uploaded JSON into `src/data/mockData.ts`, merging with existing events. Skip duplicates (same bar + same event name + same date). Add new venues and new categories/event types as needed.

## Data summary from JSON
- **146 entries** across ~30 unique bars
- **Event types**: quiz, comedy, music, networking, themed_night, screening, sport, other
- **New bars not in current data**: Celtic Cottage, Madame Claude, Arcanoa, Donau, Laksmi Bar, Quatsch Comedy Club / BAR92, Langer Wirt, Swart Bier & Weinlokal, Repeat Bar, SaliGari Bar, Anno64, Möbel Olfe, Soda Club, Trude Ruth & Goldammer, Urban Spree, Hops & Barley, Yaam, RSO.BERLIN, Wolf Cinema Berlin, Festsaal Kreuzberg, 800A Bar & Cabaret
- **Bars already in data** (potential duplicates): Alte Kantine, Ratzeputz Bar, Tipsy Bear, The Castle, Bar Degendorff, Alte Turnhalle, Badehaus Berlin, Weekend Club, Belushi's Berlin, Monkey Bar, Donau115

## Plan

### 1. Write a build script (`/tmp/import-events.ts`)
A Node/Python script that:
- Reads the JSON file
- Reads the current `mockData.ts` to extract existing event keys (venue+title+date)
- Maps JSON `event_type` to existing `categoryId`: quiz → pub-quiz, comedy → comedy, music → live-music or dj-music, networking → language-exchange, themed_night → social, screening → other, sport → other
- Generates new venue entries for bars not yet in the venues array (with approximate lat/lng from addresses)
- Generates new `BarlinEvent` entries with proper IDs (`EVT-NEW-1`, etc.) and `parentId` grouping
- Skips entries with no date or low confidence
- Outputs the merged TypeScript

### 2. Update `src/data/mockData.ts`
- Add ~20 new venue entries to the `venues` array
- Add new neighborhoods to the neighborhoods array (Steglitz, Wedding, Tempelhof)
- Append ~130+ new event entries (after dedup) to the `events` array
- Add new category entries if needed: "Screening", "Sport / Games", "Themed Night"

### 3. Update `src/assets/categories/index.ts`
- Add mappings for any new category IDs (screening, sport, themed-night)

### 4. Update `src/assets/venues/index.ts`
- No new images needed — new venues will fall back to category images

### 5. Update map icon mappings
- Add icon mappings for new categories in `MapView.tsx` (Film icon for screening, Trophy for sport, etc.)

## Duplicate detection logic
An event is a duplicate if **all three match**: normalized bar name + normalized event name + exact date. This handles bars already present under slightly different names (e.g., "Donau" in JSON vs "Donau115" in data — these are different bars so both kept).

## Technical details
- Events with empty dates (id 58, 128) will be skipped
- All 146 JSON entries will be processed; ~2-5 duplicates expected (e.g., Ratzeputz quiz, Tipsy Bear quiz already exist)
- New IDs follow pattern `EVT-IMP-{id}` to avoid collisions
- `parentId` groups recurring events by bar_name + event_name slug

