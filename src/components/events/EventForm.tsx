import { useEffect, useRef, useState, type ReactNode } from "react";
import { Upload, Calendar, Clock, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { categories } from "@/data/categories";
import DateField from "@/components/events/DateField";

export interface EventFormData {
  title: string;
  venue: string;
  address: string;
  neighborhood: string;
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  description: string;
  entryInfo: string;
  language: string;
  website: string;
  imagePosition: string;
}

export interface EventFormImageState {
  file: File | null;
  changed: boolean;
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
}

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

const DEFAULT_IMAGE_POSITION = "50% 50%";

const EMPTY_FORM: EventFormData = {
  title: "", venue: "", address: "", neighborhood: "", date: "",
  startTime: "", endTime: "", category: "", description: "",
  entryInfo: "", language: "", website: "",
  imagePosition: DEFAULT_IMAGE_POSITION,
};

const ENTRY_AMOUNTS = Array.from({ length: 100 }, (_, i) => (i + 1) * 0.5).map((n) =>
  Number.isInteger(n) ? `${n} €` : `${Math.floor(n)},50 €`
);
const PREDEFINED_ENTRY_OPTIONS = new Set<string>(["Free", "Pay what you want", ...ENTRY_AMOUNTS]);
const CUSTOM_ENTRY_SENTINEL = "__custom__";

const LANGUAGES = [
  "English",
  "German",
  "English / German",
  "Albanian",
  "Arabic",
  "Armenian",
  "Basque",
  "Belarusian",
  "Bengali",
  "Bosnian",
  "Bulgarian",
  "Catalan",
  "Chinese",
  "Croatian",
  "Czech",
  "Danish",
  "Dutch",
  "Estonian",
  "Finnish",
  "French",
  "Galician",
  "Georgian",
  "Greek",
  "Hebrew",
  "Hindi",
  "Hungarian",
  "Icelandic",
  "Indonesian",
  "Irish",
  "Italian",
  "Japanese",
  "Korean",
  "Latvian",
  "Lithuanian",
  "Luxembourgish",
  "Macedonian",
  "Maltese",
  "Montenegrin",
  "Norwegian",
  "Persian",
  "Polish",
  "Portuguese",
  "Romanian",
  "Russian",
  "Scottish Gaelic",
  "Serbian",
  "Slovak",
  "Slovenian",
  "Spanish",
  "Swahili",
  "Swedish",
  "Thai",
  "Turkish",
  "Ukrainian",
  "Urdu",
  "Vietnamese",
  "Welsh",
  "Yiddish",
];

const inputClass =
  "w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors";

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
}: EventFormProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.date && formData.startTime) {
      const eventStart = new Date(`${formData.date}T${formData.startTime}`);
      if (eventStart.getTime() <= Date.now()) {
        toast.error("Event date and start time must be in the future.");
        return;
      }
    }
    if (formData.endTime && formData.startTime === formData.endTime) {
      toast.error("End time must differ from start time.");
      return;
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
              className="relative h-64 border-2 border-border rounded-sm overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
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
            className={`border-2 border-dashed rounded-sm p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-foreground bg-muted/50"
                : "border-border hover:border-muted-foreground/50"
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
          <label className="text-sm font-medium">Event title *</label>
          <input
            type="text" required value={formData.title}
            onChange={(e) => update("title", e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> Date *</label>
            <DateField
              value={formData.date}
              onChange={(iso) => update("date", iso)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Start *</label>
            <input
              type="time" required value={formData.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> End</label>
            <input
              type="time" value={formData.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              className={inputClass}
            />
            {formData.startTime && formData.endTime && formData.endTime < formData.startTime && (
              <p className="text-xs text-accent mt-1">→ ends next day</p>
            )}
            {formData.startTime && formData.endTime && formData.endTime === formData.startTime && (
              <p className="text-xs text-destructive mt-1">End time must differ from start</p>
            )}
          </div>
        </div>

        {/* Category & Entry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1"><Tag className="h-3 w-3" /> Category *</label>
            <select
              required value={formData.category}
              onChange={(e) => update("category", e.target.value)}
              className={inputClass}
            >
              <option value="" disabled hidden>Select category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Entry info</label>
            <select
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
              <option value="Pay what you want">Pay what you want</option>
              <option value={CUSTOM_ENTRY_SENTINEL}>Custom…</option>
              {ENTRY_AMOUNTS.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
            {entryCustomMode && (
              <input
                type="text"
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
          <label className="text-sm font-medium">Description *</label>
          <textarea
            required value={formData.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Tell people what to expect..."
            rows={6}
            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors resize-none"
          />
        </div>

        {/* Language & Website/Instagram */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Language</label>
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
            <label className="text-sm font-medium">Link to event</label>
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
            className="flex-1 h-12 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
