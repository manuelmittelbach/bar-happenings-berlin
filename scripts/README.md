# Scripts

## scrape_venue_events.py

Scrapes events from venues' `website_events` URLs into the `venue_events_staging` table.
Approved venues only (`venues.online = 'yes'`).

### One-time setup

```bash
brew install ollama
ollama pull gemma3:12b
brew services start ollama

cd scripts
pip3 install -r requirements.txt
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

The service role key (NOT the anon key) is required because the scraper bypasses RLS.
Find it at: Supabase Dashboard → Project Settings → API → `service_role` key.

### Run

```bash
cd scripts
python3 scrape_venue_events.py            # normal scrape
python3 scrape_venue_events.py --clear    # wipe ALL rows from venue_events_staging and exit
```

`--clear` deletes every row in `venue_events_staging` (pending, approved, rejected
all together — `events` table is unaffected). Use this to reset the admin review
queue before a fresh scrape.

The script will:
1. Query all venues with `online='yes'` and a non-empty `website_events`
2. Fetch + parse each website
3. Send the cleaned text to Ollama (`gemma3:12b`) to extract events
4. Upsert events into `venue_events_staging` with `status='pending'`
5. Log scrape outcomes to `scrape_logs`

Re-runs are safe — duplicates (same `venue_id` + `date` + `title`) are ignored, so
already-approved or already-rejected events keep their status.

### Review staged events

Open the admin dashboard → "Scraped Events" tab → approve / reject per event.
