import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { VenueOption } from "@/components/events/EventForm";

interface VenueComboboxProps {
  options: VenueOption[];
  /* The currently selected venue id; "" means nothing is picked yet. */
  value: string;
  onSelect: (id: string) => void;
}

/* Searchable + scrollable bar picker. Replaces the plain <select>: a button
 * shows the current choice, clicking it opens a popover with a search box on
 * top and the scrollable list below. Typing filters by bar name; the data flow
 * is unchanged — onSelect(id) fires exactly like the old <select> did. */
export default function VenueCombobox({ options, value, onSelect }: VenueComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex w-full h-11 items-center justify-between gap-2 px-3 bg-background border-2 border-foreground font-serif text-base text-left outline-none focus:bg-card transition-colors"
        >
          <span className={cn("truncate", !selected && "text-foreground/30")}>
            {selected ? selected.name : "Search bar…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 rounded-none border-2 border-foreground"
      >
        {/* Match only against the bar name (the keywords below), so the id we
         * use as each item's value never pollutes the search results. */}
        <Command
          className="rounded-none"
          filter={(_value, search, keywords) => {
            const text = (keywords?.join(" ") ?? "").toLowerCase();
            return text.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search bar…" />
          <CommandList>
            <CommandEmpty>No bar found.</CommandEmpty>
            {options.map((v) => (
              <CommandItem
                key={v.id}
                value={v.id}
                keywords={[v.name]}
                onSelect={() => {
                  onSelect(v.id);
                  setOpen(false);
                }}
                className="rounded-none data-[selected='true']:bg-muted data-[selected=true]:text-foreground"
              >
                <Check
                  className={cn("mr-2 h-4 w-4 shrink-0", value === v.id ? "opacity-100" : "opacity-0")}
                />
                <span className="truncate">{v.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
