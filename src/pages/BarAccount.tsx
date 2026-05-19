import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchOrganizerById,
  updateMyVenue,
  uploadVenueImage,
  type MyVenuePatch,
} from "@/lib/supabaseQueries";
import { Spinner } from "@/components/ui/spinner";
import { PageSpinner } from "@/components/ui/page-spinner";

const SUPPORT_EMAIL = "hello@insidebars.co";
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;
const DEFAULT_POSITION = "50% 50%";

type Venue = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  image: string | null;
  imagePosition: string;
  website: string | null;
  instagram: string | null;
  phone: string | null;
};

function parsePosition(pos: string): [number, number] {
  const parts = pos.split(" ").map((p) => parseFloat(p));
  const x = Number.isFinite(parts[0]) ? parts[0] : 50;
  const y = Number.isFinite(parts[1]) ? parts[1] : 50;
  return [x, y];
}

export default function BarAccount() {
  const navigate = useNavigate();
  const { user, role, approvalStatus, loading, roleResolved } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imagePosition, setImagePosition] = useState<string>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<
    | { pointerId: number; startX: number; startY: number; px0: number; py0: number }
    | null
  >(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/for-bars", { replace: true });
      return;
    }
    if (!roleResolved) return;
    if (role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [loading, user, role, roleResolved, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchOrganizerById(user.id)
      .then((organizer) => {
        if (organizer?.venue) {
          const v = organizer.venue;
          setVenue({
            id: v.id,
            name: v.name,
            address: v.address,
            neighborhood: v.neighborhood,
            image: v.image,
            imagePosition: v.image_position,
            website: v.website,
            instagram: v.instagram,
            phone: v.phone,
          });
          setWebsite(v.website ?? "");
          setInstagram(v.instagram ?? "");
          setPhone(v.phone ?? "");
          setImagePosition(v.image_position || DEFAULT_POSITION);
        }
      })
      .finally(() => setVenueLoading(false));
  }, [user]);

  const localPreviewUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    if (!localPreviewUrl) return;
    return () => URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  const displayedImageUrl: string | null = imageFile
    ? localPreviewUrl
    : imageRemoved
      ? null
      : venue?.image ?? null;

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
    setImagePosition(DEFAULT_POSITION);
  };

  const handlePreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = previewContainerRef.current;
    if (!container) return;
    const [px0, py0] = parsePosition(imagePosition);
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
    setImagePosition(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };

  const handlePreviewPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    const container = previewContainerRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    container?.releasePointerCapture(e.pointerId);
    dragStateRef.current = null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !venue) return;
    setSaving(true);
    try {
      const patch: MyVenuePatch = {};

      if (imageFile) {
        const url = await uploadVenueImage(imageFile, user.id);
        patch.image = url;
        patch.image_position = imagePosition;
      } else if (imageRemoved) {
        patch.image = null;
        patch.image_position = DEFAULT_POSITION;
      } else if (imagePosition !== venue.imagePosition && venue.image) {
        // Position changed on existing image
        patch.image_position = imagePosition;
      }

      const trimmedWebsite = website.trim();
      const trimmedInstagram = instagram.trim();
      const trimmedPhone = phone.trim();

      if (trimmedWebsite !== (venue.website ?? "")) {
        patch.website = trimmedWebsite === "" ? null : trimmedWebsite;
      }
      if (trimmedInstagram !== (venue.instagram ?? "")) {
        patch.instagram = trimmedInstagram === "" ? null : trimmedInstagram;
      }
      if (trimmedPhone !== (venue.phone ?? "")) {
        patch.phone = trimmedPhone === "" ? null : trimmedPhone;
      }

      if (Object.keys(patch).length === 0) {
        toast("Nothing changed.");
        setSaving(false);
        return;
      }

      const updated = await updateMyVenue(patch);
      setVenue({
        ...venue,
        image: updated.image,
        imagePosition: updated.image_position,
        website: updated.website,
        instagram: updated.instagram,
        phone: updated.phone,
      });
      setImageFile(null);
      setImageRemoved(false);
      setImagePosition(updated.image_position);
      toast.success("Bar account updated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't save changes.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !roleResolved || venueLoading) {
    return <PageSpinner />;
  }
  if (!user) return null;

  if (role === "organizer" && approvalStatus !== "approved") {
    const rejected = approvalStatus === "rejected";
    return (
      <div className="container max-w-2xl py-10 md:py-14">
        <h1 className="heading-display text-3xl md:text-4xl mb-4">Bar account</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {rejected
            ? "Your bar account application was not approved. If you think this is a mistake, please contact us."
            : "Your bar account is awaiting admin approval. Once approved you'll be able to manage your bar details and upload a cover image here."}
        </p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="container max-w-2xl py-10 md:py-14">
        <h1 className="heading-display text-3xl md:text-4xl mb-4">Bar account</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          No bar is linked to your account yet. Please contact us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-foreground underline hover:text-accent transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-10 md:py-14">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 mb-6 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="mb-10 border-b-2 border-foreground pb-6">
        <h1 className="heading-display text-4xl md:text-5xl leading-[0.95]">
          Bar account
        </h1>
        <p className="mt-2 text-base md:text-lg text-muted-foreground">{venue.name}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-10">
        {/* Cover image */}
        <section>
          <h2 className="mono-label text-foreground mb-4">Cover image</h2>
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
          {displayedImageUrl ? (
            <div className="space-y-2">
              <div
                ref={previewContainerRef}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerUp}
                onPointerCancel={handlePreviewPointerUp}
                className="relative h-64 border-2 border-foreground overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
              >
                <img
                  src={displayedImageUrl}
                  alt={`${venue.name} cover`}
                  draggable={false}
                  style={{ objectPosition: imagePosition }}
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Drag the image to reposition the focal point.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" /> Replace
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
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
                {isDragging
                  ? "Drop image here"
                  : "Drag & drop or click to upload a cover image"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG or WebP, max {MAX_SIZE_MB}MB
              </p>
            </div>
          )}
        </section>

        {/* Contact + links */}
        <section className="space-y-4">
          <h2 className="mono-label text-foreground">Links & contact</h2>
          <div className="space-y-1.5">
            <label className="mono-label text-muted-foreground">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="mono-label text-muted-foreground">Instagram</label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourbar or full URL"
              className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="mono-label text-muted-foreground">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 30 1234 5678"
              className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
            />
          </div>
        </section>

        {/* Save */}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 h-12 px-6 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground active:scale-[0.98] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-foreground disabled:hover:text-background"
          >
            {saving ? (
              <>
                <Spinner className="h-3.5 w-3.5" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* Read-only details */}
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="mono-label text-foreground mb-4">Bar details</h2>
        <div className="border-2 border-foreground p-5 bg-card">
          <p className="text-lg font-serif font-bold leading-tight">{venue.name}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {venue.address.replace(/,\s*Germany\s*$/i, "")}
          </p>
          {venue.neighborhood && (
            <p className="text-sm text-muted-foreground">{venue.neighborhood}</p>
          )}
          <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
            <Mail className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Need to change the bar name or address? Email us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground underline hover:text-accent transition-colors"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
