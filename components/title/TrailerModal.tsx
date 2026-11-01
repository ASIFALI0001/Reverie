"use client";

import { Dialog } from "@/components/ui/Dialog";

/** Full-screen player on a deep backdrop. The iframe exists only while open (privacy-enhanced domain). */
export function TrailerModal({
  videoId,
  title,
  open,
  onOpenChange,
}: {
  videoId: string | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open && Boolean(videoId)} onOpenChange={onOpenChange} title={title} hideTitle variant="cinema">
      <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-panel)] bg-black">
        {videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            className="size-full"
          />
        ) : null}
      </div>
    </Dialog>
  );
}
