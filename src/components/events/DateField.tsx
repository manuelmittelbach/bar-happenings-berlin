import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateFieldProps {
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  min?: string;
}

export default function DateField({ value, onChange, required, min }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selectedValid = selected && isValid(selected) ? selected : undefined;
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;
  const minDateValid = minDate && isValid(minDate) ? minDate : undefined;

  return (
    <div className="flex items-stretch bg-muted/50 border border-border rounded-sm focus-within:border-foreground transition-colors">
      <input
        type="date"
        required={required}
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-10 px-3 bg-transparent border-0 rounded-sm text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open calendar"
            className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground border-l border-border shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedValid}
            defaultMonth={selectedValid}
            disabled={minDateValid ? { before: minDateValid } : undefined}
            onSelect={(picked) => {
              if (picked) {
                onChange(format(picked, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
