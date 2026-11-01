"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { currentIdToken } from "@/lib/auth/firebase-client";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";

type Format = "story" | "wide";
const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "story", label: "Story", hint: "9:16, for stories" },
  { id: "wide", label: "Wide", hint: "For posts and chats" },
];

export function ShareTasteButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className={className} onClick={() => setOpen(true)}>
        <ShareNetwork size={18} weight="light" aria-hidden="true" /> Share your taste
      </Button>
      <ShareTasteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Your taste as an image: pick a shape, then download it or hand it to the phone's share sheet. */
function ShareTasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [format, setFormat] = useState<Format>("story");
  const card = useQuery({
    queryKey: ["taste", "card", format],
    queryFn: async () => {
      const token = await currentIdToken();
      const res = await fetch(`/api/taste/card?format=${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("The card didn’t load.");
      return res.blob();
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const src = useMemo(() => (card.data ? URL.createObjectURL(card.data) : null), [card.data]);
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);
  const file = card.data ? new File([card.data], `reverie-taste-${format}.png`, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  function download() {
    if (!src) return;
    Object.assign(document.createElement("a"), { href: src, download: `reverie-taste-${format}.png` }).click();
  }
  async function share() {
    try {
      await navigator.share({ files: [file!], title: "My taste on Reverie" });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") toast({ title: "Couldn’t open sharing. Download it instead.", tone: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share your taste" description="Your Taste DNA, your top-rated titles, your eras and a code that lets anyone compare their taste with yours.">
      <div role="radiogroup" aria-label="Shape" className="mt-5 inline-flex rounded-full border border-hairline-strong p-1">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={format === f.id}
            onClick={() => setFormat(f.id)}
            className={cn("rounded-full px-4 py-1.5 text-[0.875rem] transition-colors duration-200", format === f.id ? "bg-text text-bg" : "text-muted hover:text-text")}
          >
            {f.label} <span className={cn("hidden sm:inline", format === f.id ? "text-bg/80" : "text-muted")}>· {f.hint}</span>
          </button>
        ))}
      </div>
      <div className={cn("mx-auto mt-5 overflow-hidden rounded-[6px] border border-hairline", format === "story" ? "aspect-[9/16] max-h-[56dvh]" : "aspect-[1200/630] w-full")}>
        {src ? (
          // A blob from our own API: next/image has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Your taste card" className="size-full object-contain" />
        ) : card.isError ? (
          <p className="grid size-full place-items-center p-6 text-center text-muted">The card didn’t load. Close this and try again.</p>
        ) : (
          <Skeleton className="size-full" />
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={download} disabled={!src}>
          <DownloadSimple size={18} weight="light" aria-hidden="true" /> Download
        </Button>
        {canShare ? (
          <Button variant="secondary" onClick={share}>
            <ShareNetwork size={18} weight="light" aria-hidden="true" /> Share
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
