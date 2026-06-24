import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VenueOption } from "@/components/events/EventForm";

interface VenueComboboxProps {
  options: VenueOption[];
  /* The currently selected venue id; "" means nothing is picked yet. */
  value: string;
  onSelect: (id: string) => void;
  /* Switch the form to free-text address entry — offered when a search
   * turns up no matching bar. */
  onEnterManual: () => void;
}

/* Searchable + scrollable bar picker as a single field. Click it to focus,
 * then either type to filter by name OR scroll the list and click a bar. The
 * data flow is unchanged — onSelect(id) fires exactly like the old <select>. */
export default function VenueCombobox({ options, value, onSelect, onEnterManual }: VenueComboboxProps) {
  const selected = options.find((o) => o.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  // While the field is focused the user sees their live search; when it's
  // closed it falls back to showing the chosen bar's name.
  const inputValue = open ? query : selected?.name ?? "";

  // Filter by the typed text (case-insensitive). An empty query — e.g. right
  // after focusing — shows the whole list to scroll through.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const choose = (o: VenueOption) => {
    onSelect(o.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2 h-11 px-3 bg-background border-2 border-foreground focus-within:bg-card transition-colors">
        <Search className="h-4 w-4 shrink-0 opacity-50" />
        <input
          type="text"
          value={inputValue}
          placeholder="Search bar…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            window.clearTimeout(closeTimer.current);
            setQuery("");
            setOpen(true);
          }}
          // Close a tick after blur so a click on a list item still registers.
          onBlur={() => {
            closeTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
          className="w-full bg-transparent font-serif text-base outline-none placeholder:text-foreground/30"
        />
      </label>

      {open && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-[340px] overflow-y-auto overscroll-none bg-popover border-2 border-foreground">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center">
              <p className="text-sm text-foreground/50">No bar found.</p>
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so the choice lands before the
                  // input's blur closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  className={cn(
                    "block w-full px-3 py-2 text-left font-serif text-base transition-colors hover:bg-foreground hover:text-background",
                    o.id === value && "bg-foreground text-background",
                  )}
                >
                  {o.name}
                </button>
              </li>
            ))
          )}
          {/* Manual-entry escape hatch, pinned to the bottom of the list. A user
              can scroll the whole list, not find their bar, and still switch to
              typing it in — it's no longer gated on an empty search. */}
          <li className="sticky bottom-0 border-t-2 border-foreground/15 bg-popover">
            <button
              type="button"
              // onMouseDown (not onClick) so it fires before the input blurs.
              onMouseDown={(e) => {
                e.preventDefault();
                onEnterManual();
              }}
              className="block w-full px-3 py-2.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background"
            >
              Not in the list? Enter manually!
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
