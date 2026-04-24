import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateShort } from "@/lib/dateFormat";

interface DateFieldProps {
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
}

export default function DateField({ value, onChange, required, min, max }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selectedValid = selected && isValid(selected) ? selected : undefined;
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;
  const minDateValid = minDate && isValid(minDate) ? minDate : undefined;
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : undefined;
  const maxDateValid = maxDate && isValid(maxDate) ? maxDate : undefined;
  const disabledMatcher = [
    ...(minDateValid ? [{ before: minDateValid }] : []),
    ...(maxDateValid ? [{ after: maxDateValid }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full h-10 px-3 flex items-center justify-between gap-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors ${
            !value ? "text-muted-foreground/60" : ""
          }`}
        >
          <span>{selectedValid ? formatDateShort(value) : "Select date"}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedValid}
          defaultMonth={selectedValid}
          disabled={disabledMatcher.length > 0 ? disabledMatcher : undefined}
          onSelect={(picked) => {
            if (picked) {
              onChange(format(picked, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </Popover>
  );
}
