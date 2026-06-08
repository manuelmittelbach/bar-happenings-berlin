import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { fromZonedTime } from "date-fns-tz";
import { LANGUAGES } from "@/data/languages";
import { deriveNeighborhood } from "@/lib/neighborhoodFromAddress";
import VenueAddressFields from "@/components/events/VenueAddressFields";
import { buildVenueAddress, type VenueFields } from "@/lib/venueAddress";
import { useCategories } from "@/hooks/useEvents";
import { CUSTOM_ENTRY_SENTINEL, ENTRY_AMOUNTS, PREDEFINED_ENTRY_OPTIONS } from "@/data/entryOptions";
import {
  addOneDay,
  defaultUntil,
  describeRule,
  generateOccurrences,
  type RecurrenceFreq,
} from "@/lib/recurrence";
import { formatDateShort } from "@/lib/dateFormat";

export interface EventFormData {
  title: string;
  venue: string;
  venueId?: string;
  address: string;
  neighborhood: string;
  date: string;
  startTime: string;
  endTime: string;
  doorsTime: string;
  category: string;
  description: string;
  entryInfo: string;
  language: string;
  website: string;
  imagePosition: string;
  recurrence: string;
  recurrenceUntil: string;
}

const MAX_OCCURRENCES = 200;

function todayLocalISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const RECURRENCE_OPTIONS: { value: "" | RecurrenceFreq; label: string }[] = [
  { value: "", label: "Does not repeat" },
  { value: "weekly", label: "Weekly — every week" },
  { value: "biweekly", label: "Biweekly — 1st+3rd or 2nd+4th weekday" },
  { value: "monthly_by_weekday", label: "Monthly — same weekday of month" },
  { value: "monthly_last_weekday", label: "Monthly — last weekday of month" },
];

export interface EventFormImageState {
  file: File | null;
  changed: boolean;
}

/* A bar the submitter can attach the event to. When `venueOptions` is passed
 * the form shows a Location picker (used for plain users who have no bar of
 * their own); bar owners keep the prefilled-from-their-bar behaviour. */
export interface VenueOption {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
}

interface EventFormProps {
  title: string;
  subtitle?: string;
  initialValues?: Partial<EventFormData>;
  initialImageUrl?: string | null;
  submitLabel: string;
  submittingLabel?: string;
  onSubmit: (data: EventFormData, image: EventFormImageState) => Promise<void>;
  secondaryActions?: ReactNode;
  footer?: ReactNode;
  recurrenceLocked?: boolean;
  optionalStartTime?: boolean;
  optionalEndTime?: boolean;
  optionalDescription?: boolean;
  /* When provided, render the Location picker (choose an existing bar OR enter
   * a free-text venue). Omit it to keep the venue prefilled/read-only. */
  venueOptions?: VenueOption[];
}

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

const DEFAULT_IMAGE_POSITION = "50% 50%";

const EMPTY_FORM: EventFormData = {
  title: "", venue: "", venueId: "", address: "", neighborhood: "", date: "",
  startTime: "", endTime: "", doorsTime: "", category: "", description: "",
  entryInfo: "", language: "", website: "",
  imagePosition: DEFAULT_IMAGE_POSITION,
  recurrence: "", recurrenceUntil: "",
};

const inputClass =
  "w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30";

// Mono-uppercase eyebrow label — matches the Create-account / sign-in forms.
const labelClass =
  "font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55";

export default function EventForm({
  title,
  subtitle,
  initialValues,
  initialImageUrl,
  submitLabel,
  submittingLabel,
  onSubmit,
  secondaryActions,
  footer,
  recurrenceLocked = false,
  optionalStartTime = false,
  optionalEndTime = false,
  optionalDescription = false,
  venueOptions,
}: EventFormProps) {
  const { data: categoriesData = [] } = useCategories();
  // Form holds the slug-id (categories.id) as the value; we display the label.
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled),
    [categoriesData],
  );
  const [formData, setFormData] = useState<EventFormData>({ ...EMPTY_FORM, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [entryCustomMode, setEntryCustomMode] = useState<boolean>(
    () => {
      const v = initialValues?.entryInfo ?? "";
      return v !== "" && !PREDEFINED_ENTRY_OPTIONS.has(v);
    }
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; px0: number; py0: number } | null>(null);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, ...initialValues }));
    const incoming = initialValues?.entryInfo;
    if (incoming !== undefined) {
      setEntryCustomMode(incoming !== "" && !PREDEFINED_ENTRY_OPTIONS.has(incoming));
    }
  }, [initialValues]);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!imageRemoved && initialImageUrl) {
      setImagePreview(initialImageUrl);
      return;
    }
    setImagePreview(null);
  }, [imageFile, imageRemoved, initialImageUrl]);

  const update = (field: keyof EventFormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Location picker (only rendered when `venueOptions` is provided).
  const [venueMode, setVenueMode] = useState<"existing" | "manual">("existing");
  // Manual-location sub-fields — same shape as the bar-signup address form
  // (street + house no., postal code, city). They feed formData.address and an
  // auto-derived neighborhood; only used in the "Enter manually" branch.
  const [manualStreet, setManualStreet] = useState("");
  const [manualPlz, setManualPlz] = useState("");
  const [manualCity, setManualCity] = useState("");

  // Rebuild the combined address + derived neighborhood whenever a sub-field
  // changes (mirrors Login.tsx: `${street}, ${plz} ${city}`).
  const setManualVenue = (v: VenueFields) => {
    setManualStreet(v.street);
    setManualPlz(v.plz);
    setManualCity(v.city);
    setFormData((prev) => ({
      ...prev,
      venue: v.name,
      address: buildVenueAddress(v),
      neighborhood: deriveNeighborhood(v.street, v.plz),
    }));
  };

  const selectVenue = (id: string) => {
    const v = venueOptions?.find((o) => o.id === id);
    setFormData((prev) => ({
      ...prev,
      venueId: id,
      venue: v?.name ?? "",
      address: v?.address ?? "",
      neighborhood: v?.neighborhood ?? "",
    }));
  };

  const changeVenueMode = (mode: "existing" | "manual") => {
    setVenueMode(mode);
    // Reset the manual sub-fields and clear address/neighborhood so a stale
    // selection (or a previously picked bar) can't leak through on submit.
    setManualStreet("");
    setManualPlz("");
    setManualCity("");
    setFormData((prev) => ({
      ...prev,
      venueId: "",
      address: "",
      neighborhood: "",
      ...(mode === "existing" ? { venue: "" } : {}),
    }));
  };

  const handleFile = (file: File) => {
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error("Please upload a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image is too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }
    setImageFile(file);
    setImageRemoved(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageRemoved(true);
    setFormData((prev) => ({ ...prev, imagePosition: DEFAULT_IMAGE_POSITION }));
  };

  const parsePosition = (pos: string): [number, number] => {
    const parts = pos.split(" ").map((p) => parseFloat(p));
    const x = Number.isFinite(parts[0]) ? parts[0] : 50;
    const y = Number.isFinite(parts[1]) ? parts[1] : 50;
    return [x, y];
  };

  const handlePreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = previewContainerRef.current;
    if (!container) return;
    const [px0, py0] = parsePosition(formData.imagePosition);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      px0,
      py0,
    };
    container.setPointerCapture(e.pointerId);
  };

  const handlePreviewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    const container = previewContainerRef.current;
    if (!state || !container || state.pointerId !== e.pointerId) return;
    const rect = container.getBoundingClientRect();
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const newX = Math.max(0, Math.min(100, state.px0 - (dx / rect.width) * 100));
    const newY = Math.max(0, Math.min(100, state.py0 - (dy / rect.height) * 100));
    setFormData((prev) => ({ ...prev, imagePosition: `${newX.toFixed(1)}% ${newY.toFixed(1)}%` }));
  };

  const handlePreviewPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    const container = previewContainerRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    container?.releasePointerCapture(e.pointerId);
    dragStateRef.current = null;
  };

  const todayMin = useMemo(() => todayLocalISO(), []);

  const occurrencePreview = useMemo(() => {
    if (!formData.recurrence || !formData.date || !formData.recurrenceUntil) return null;
    const freq = formData.recurrence as RecurrenceFreq;
    const dates = generateOccurrences(formData.date, freq, formData.recurrenceUntil, MAX_OCCURRENCES + 1);
    return { freq, dates };
  }, [formData.recurrence, formData.date, formData.recurrenceUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (venueOptions) {
      if (venueMode === "existing" && !formData.venueId) {
        toast.error("Please choose a bar, or switch to entering a location manually.");
        return;
      }
      if (
        venueMode === "manual" &&
        (!formData.venue.trim() || !manualStreet.trim() || !manualPlz.trim() || !manualCity.trim())
      ) {
        toast.error("Please enter the venue name, street, postal code and city.");
        return;
      }
    }
    if (formData.date && formData.startTime) {
      const eventStart = fromZonedTime(`${formData.date}T${formData.startTime}`, "Europe/Berlin");
      if (eventStart.getTime() <= Date.now()) {
        toast.error("Event date and start time must be in the future.");
        return;
      }
    }
    if (!optionalEndTime && !formData.endTime) {
      toast.error("Please add an end time.");
      return;
    }
    if (formData.endTime && formData.startTime === formData.endTime) {
      toast.error("End time must differ from start time.");
      return;
    }
    if (formData.recurrence) {
      if (!formData.recurrenceUntil) {
        toast.error("Pick an end date for the recurring series.");
        return;
      }
      if (formData.recurrenceUntil < formData.date) {
        toast.error("End date must be on or after the start date.");
        return;
      }
      if (formData.recurrenceUntil > defaultUntil(formData.date)) {
        toast.error("Recurring series can run for a maximum of 6 months.");
        return;
      }
      if (occurrencePreview && occurrencePreview.dates.length > MAX_OCCURRENCES) {
        toast.error(`Too many occurrences (max ${MAX_OCCURRENCES}). Pick a closer end date.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const imageChanged = imageFile !== null || imageRemoved;
      await onSubmit(formData, { file: imageFile, changed: imageChanged });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="heading-display text-3xl mb-2">{title}</h1>
      {subtitle && <p className="text-muted-foreground text-sm mb-8">{subtitle}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cover image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {imagePreview ? (
          <div className="space-y-2">
            <div
              ref={previewContainerRef}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={handlePreviewPointerUp}
              onPointerCancel={handlePreviewPointerUp}
              className="relative aspect-[3/2] md:aspect-[16/9] border-2 border-foreground overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <img
                src={imagePreview}
                alt="Cover preview"
                draggable={false}
                style={{ objectPosition: formData.imagePosition }}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
              <button
                type="button"
                // Stop the pointerdown from reaching the container's drag handler —
                // otherwise the container captures the pointer and the click lands
                // on it instead of this button, so removal never fires.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center bg-black/70 text-white rounded-full hover:bg-black/90 transition-colors"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Drag the image to reposition the focal point.</p>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-foreground bg-muted/50"
                : "border-foreground/40 hover:border-foreground"
            }`}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {isDragging ? "Drop image here" : "Drag & drop or click to upload cover image"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP, max 5MB</p>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className={labelClass}>Event title <span className="text-accent">*</span></label>
          <input
            type="text" required value={formData.title}
            onChange={(e) => update("title", e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Location — only shown when the caller passes venueOptions (plain
            users without a bar). Bar owners keep the prefilled venue. */}
        {venueOptions && (
          <div className="space-y-3">
            <label className={labelClass}>Location <span className="text-accent">*</span></label>
            <div className="flex gap-2">
              {(["existing", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeVenueMode(mode)}
                  className={`h-9 px-3 border-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                    venueMode === mode
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  {mode === "existing" ? "Choose a bar" : "Enter manually"}
                </button>
              ))}
            </div>
            {venueMode === "existing" ? (
              <select
                value={formData.venueId ?? ""}
                onChange={(e) => selectVenue(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a bar…</option>
                {venueOptions.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            ) : (
              <VenueAddressFields
                value={{ name: formData.venue, street: manualStreet, plz: manualPlz, city: manualCity }}
                onChange={setManualVenue}
              />
            )}
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 min-w-0">
            <label className={labelClass}>Date <span className="text-accent">*</span></label>
            <input
              type="date"
              required
              value={formData.date}
              min={todayMin}
              onChange={(e) => update("date", e.target.value)}
              className={`${inputClass} appearance-none min-w-0`}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <label className={labelClass}>
              Start{optionalStartTime ? "" : <span className="text-accent"> *</span>}
            </label>
            <input
              type="time"
              required={!optionalStartTime}
              value={formData.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              className={`${inputClass} appearance-none min-w-0`}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <label className={labelClass}>
              End{optionalEndTime ? "" : <span className="text-accent"> *</span>}
            </label>
            <input
              type="time"
              required={!optionalEndTime}
              value={formData.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              className={`${inputClass} appearance-none min-w-0`}
            />
            {formData.startTime && formData.endTime && formData.endTime < formData.startTime && (
              <p className="text-xs text-accent mt-1">→ ends next day</p>
            )}
            {formData.startTime && formData.endTime && formData.endTime === formData.startTime && (
              <p className="text-xs text-destructive mt-1">End time must differ from start</p>
            )}
          </div>
          <div className="space-y-1.5 min-w-0">
            <label className={labelClass}>Doors</label>
            <input
              type="time" value={formData.doorsTime}
              onChange={(e) => update("doorsTime", e.target.value)}
              className={`${inputClass} appearance-none min-w-0`}
            />
            {formData.doorsTime && formData.startTime && formData.doorsTime >= formData.startTime && (
              <p className="text-xs text-muted-foreground mt-1">Doors are usually before the start time</p>
            )}
          </div>
        </div>

        {/* Recurrence */}
        {!recurrenceLocked && (
          <div className="space-y-1.5">
            <label className={labelClass}>Repeats</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                value={formData.recurrence}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData((prev) => {
                    const next = { ...prev, recurrence: v };
                    if (v && !prev.recurrenceUntil && prev.date) {
                      next.recurrenceUntil = defaultUntil(prev.date);
                    }
                    if (!v) next.recurrenceUntil = "";
                    return next;
                  });
                }}
                className={inputClass}
                disabled={!formData.date}
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {formData.recurrence && (
                <div className="space-y-1.5">
                  <input
                    type="date"
                    value={formData.recurrenceUntil}
                    min={formData.date ? addOneDay(formData.date) : undefined}
                    max={formData.date ? defaultUntil(formData.date) : undefined}
                    onChange={(e) => update("recurrenceUntil", e.target.value)}
                    className={`${inputClass} appearance-none min-w-0`}
                  />
                </div>
              )}
            </div>
            {!formData.date && (
              <p className="text-xs text-muted-foreground">Pick a start date first to enable recurrence.</p>
            )}
            {formData.recurrence && formData.date && (
              <p className="text-xs text-muted-foreground">Series can run for up to 6 months.</p>
            )}
            {occurrencePreview && occurrencePreview.dates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {describeRule(formData.date, occurrencePreview.freq)} · creates{" "}
                {occurrencePreview.dates.length > MAX_OCCURRENCES
                  ? `${MAX_OCCURRENCES}+ events — pick a closer end date`
                  : `${occurrencePreview.dates.length} event${occurrencePreview.dates.length === 1 ? "" : "s"}`}
                {occurrencePreview.dates.length > 1 && occurrencePreview.dates.length <= MAX_OCCURRENCES && (
                  <>
                    {" "}·{" "}
                    {formatDateShort(occurrencePreview.dates[0])}
                    {" → "}
                    {formatDateShort(occurrencePreview.dates[occurrencePreview.dates.length - 1])}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Category & Entry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Category <span className="text-accent">*</span></label>
            <select
              required value={formData.category}
              onChange={(e) => update("category", e.target.value)}
              className={inputClass}
            >
              <option value="" disabled hidden>Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Entry info <span className="text-accent">*</span></label>
            <select
              required
              value={entryCustomMode ? CUSTOM_ENTRY_SENTINEL : formData.entryInfo}
              onChange={(e) => {
                const v = e.target.value;
                if (v === CUSTOM_ENTRY_SENTINEL) {
                  setEntryCustomMode(true);
                  update("entryInfo", "");
                } else {
                  setEntryCustomMode(false);
                  update("entryInfo", v);
                }
              }}
              className={inputClass}
            >
              <option value="" disabled hidden>Select entry info</option>
              <option value="Free">Free</option>
              <option value="Donation">Donation</option>
              <option value={CUSTOM_ENTRY_SENTINEL}>Custom…</option>
              {ENTRY_AMOUNTS.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
            {entryCustomMode && (
              <input
                type="text"
                required
                value={formData.entryInfo}
                onChange={(e) => update("entryInfo", e.target.value)}
                placeholder="e.g. First drink costs double"
                className={inputClass}
              />
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className={labelClass}>Description{optionalDescription ? "" : <span className="text-accent"> *</span>}</label>
          <textarea
            required={!optionalDescription}
            value={formData.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Tell people what to expect..."
            rows={6}
            className="w-full px-3 py-2 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors resize-none placeholder:text-foreground/30"
          />
        </div>

        {/* Language & Website/Instagram */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Language of the event</label>
            <select
              value={formData.language}
              onChange={(e) => update("language", e.target.value)}
              className={inputClass}
            >
              <option value="" disabled hidden>Select language</option>
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Link to event</label>
            <input
              type="url" value={formData.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="https://example.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Primary + secondary actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-12 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground active:scale-[0.98] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-foreground disabled:hover:text-background"
          >
            {submitting ? (submittingLabel ?? "Submitting…") : submitLabel}
          </button>
          {secondaryActions}
        </div>

        {footer}
      </form>
    </div>
  );
}
