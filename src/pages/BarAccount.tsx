import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clock3, Eye, Globe, Instagram, Mail, Phone, Save, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
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
      navigate("/signin", { replace: true });
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
      // Bust the SW cache for the venues list — sw.ts uses StaleWhileRevalidate
      // on /rest/v1/venues, so without this the public /bars page would keep
      // serving the pre-edit venue row (and old image URL) until the SW's
      // background revalidation catches up on a later visit.
      if (typeof caches !== "undefined") {
        await caches.delete("supabase-venues");
      }
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      toast.success("Your bar updated.");
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
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
          <div className="flex justify-center">
            {rejected ? (
              <XCircle className="h-10 w-10 text-accent" />
            ) : (
              <Clock3 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <h1 className="heading-display text-2xl">
            {rejected ? "Application not approved" : "Awaiting admin approval"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {rejected
              ? "Your bar account application was not approved. If you think this is a mistake, please contact us."
              : "Thanks for signing up! An admin needs to review your bar details before you can manage your bar and upload a cover image here. You'll get access automatically as soon as your account is approved."}
          </p>
          {!rejected && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do this to protect you and the bar community — only real owners or staff should be able to publish events for a bar.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="container max-w-2xl py-10 md:py-14">
        <header className="mb-6 md:mb-8">
          <div className="pt-2.5 pb-2.5 flex items-baseline border-b-2 border-border">
            <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">Your bar</h1>
          </div>
        </header>
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
    <div className="relative">
      {/* Sticky Back row — mirrors EventDetail/BarDetail so the back
          affordance sits at the same screen position across detail-style
          pages, regardless of where the user came from. */}
      <div
        className="sticky z-40 bg-background"
        style={{ top: 0 }}
      >
        <div className="container flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
          </button>
        </div>
      </div>

      <div className="container max-w-2xl pt-4 pb-10 md:pb-14">
        {/* Masthead — Bars-directory pattern: compact heading-display on
            a hairline rule, the bar's name reading below like a directory
            card. */}
        <header className="mb-8 md:mb-10">
          <div className="pt-2.5 pb-2.5 border-b-2 border-border">
            <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">Your bar</h1>
          </div>
          <p className="mt-3 font-body text-[17px] md:text-[19px] font-bold leading-tight">{venue.name}</p>
        </header>

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
                className="relative aspect-[4/3] border-2 border-foreground overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
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
                  onPointerDown={(e) => e.stopPropagation()}
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
            // Empty state mirrors the BarsList "no image" placeholder exactly
            // (warm radial tint, crosshairs, accent dot, mono caption) so the
            // owner sees the actual fallback visitors get on /bars. The whole
            // tile is the upload affordance — click or drop a file to add one.
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative aspect-[4/3] border-2 overflow-hidden cursor-pointer transition-colors ${
                isDragging
                  ? "border-foreground bg-muted/50"
                  : "border-foreground hover:border-accent"
              }`}
              style={{
                background:
                  "radial-gradient(circle at 28% 32%, hsla(28, 85%, 55%, 0.20), hsla(18, 85%, 52%, 0.06) 65%)",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-1/2 h-px bg-foreground/10"
                style={{ transform: "translateY(-0.5px)" }}
              />
              <span
                aria-hidden
                className="absolute inset-y-0 left-1/2 w-px bg-foreground/10"
                style={{ transform: "translateX(-0.5px)" }}
              />
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 rounded-full bg-accent"
                style={{ width: 8, height: 8, transform: "translate(-50%, -50%)" }}
              />
              <span className="absolute right-3 bottom-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/45">
                Inside · Bars
              </span>
              {/* Upload affordance — bottom-left so it doesn't cover the
                  Inside·Bars caption or the centered accent dot. */}
              <div className="absolute left-3 bottom-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/70">
                <Upload className="h-3 w-3" />
                {isDragging ? "Drop image" : "Click or drop to add"}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            By uploading, you confirm that you hold the rights to this image
            and grant Inside Bars permission to display it on the public bars
            directory. See our{" "}
            <a
              href="/impressum"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
            >
              image rights notice
            </a>
            .
          </p>
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

        {/* Save + Preview */}
        <div className="flex flex-wrap items-center gap-3">
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
          <a
            href={`/bar/${venue.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 h-12 px-6 border-2 border-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </a>
        </div>
      </form>

      {/* Read-only details */}
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="mono-label text-foreground mb-4">Bar details</h2>
        <div className="border-2 border-foreground p-5 bg-card shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)]">
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
    </div>
  );
}
