import { useState, ReactNode } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface ShareMenuProps {
  eventTitle: string;
  eventId: string;
  variant?: "icon" | "full" | "header" | "pill" | "icon-circle" | "primary-cta";
}

export default function ShareMenu({ eventTitle, eventId, variant = "icon" }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/event/${eventId}`;
  const text = `Check out "${eventTitle}" on Inside Bars!`;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: eventTitle, text, url });
    } catch (err) {
      // User dismissed the sheet — silent. Anything else surfaces a toast.
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Could not share");
      }
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Non-secure context (HTTP over LAN IP) and older WebKit lack navigator.clipboard
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand copy failed");
      }
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const shareLinks = [
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      ),
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      ),
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      ),
    },
  ];

  const renderTriggerButton = (onClick?: () => void): ReactNode =>
    variant === "full" ? (
      <button onClick={onClick} className="w-full h-12 bg-accent/10 border-2 border-accent/40 text-[13px] font-heading font-bold uppercase tracking-wider text-accent hover:bg-accent/20 hover:border-accent hover:shadow-[0_0_18px_hsl(18_85%_52%/0.3)] transition-all duration-300 flex items-center justify-center gap-2">
        <Share2 className="h-4 w-4" /> Share with friends
      </button>
    ) : variant === "header" ? (
      <button onClick={onClick} className="text-xs font-mono text-accent cursor-pointer">
        Share event
      </button>
    ) : variant === "pill" ? (
      <button onClick={onClick} className="h-12 px-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider font-body rounded-full border-2 bg-transparent text-foreground border-accent hover:bg-accent/10 transition-all duration-200 active:scale-[0.98]">
        <Share2 className="h-4 w-4" />
        Share
      </button>
    ) : variant === "icon-circle" ? (
      <button onClick={onClick} aria-label="Share" className="h-12 w-12 shrink-0 flex items-center justify-center rounded-full border-2 bg-transparent text-foreground border-accent hover:bg-accent/10 transition-all duration-200 active:scale-[0.98]">
        <Share2 className="h-4 w-4" />
      </button>
    ) : variant === "primary-cta" ? (
      <button onClick={onClick} className="inline-flex items-center gap-2 h-12 px-6 bg-accent text-accent-foreground font-mono text-xs font-bold uppercase tracking-[0.08em] hover:bg-accent/90 active:scale-[0.98] transition-all duration-200">
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>
    ) : (
      <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-3 border-2 border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all text-[10px] font-heading font-bold uppercase tracking-wider w-full">
        <Share2 className="h-5 w-5" />
        Share
      </button>
    );

  if (canNativeShare) {
    return <>{renderTriggerButton(handleNativeShare)}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{renderTriggerButton()}</PopoverTrigger>
      <PopoverContent className="w-56 p-2 border-2 border-foreground" align="end">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-2 py-2 text-sm hover:bg-muted transition-colors w-full"
          >
            {link.icon}
            <span>{link.name}</span>
          </a>
        ))}
        <div className="my-1 border-t border-border" />
        <button
          onClick={handleCopy}
          className="flex items-center gap-3 px-2 py-2 text-sm hover:bg-muted transition-colors w-full"
        >
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? "Copied!" : "Copy link"}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
