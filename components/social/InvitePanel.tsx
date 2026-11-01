"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Copy, DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMyInvite } from "@/lib/api/social";
import { currentIdToken } from "@/lib/auth/firebase-client";
import { toast } from "@/lib/store/toast";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Your invite: the QR printed dark on a paper plate (how phones scan best, in either theme),
 * the link, and three ways to pass it on: copy, the share sheet, or the designed card as a PNG.
 */
export function InvitePanel({ className, bare = false }: { className?: string; bare?: boolean }) {
  const { data, error, refetch } = useMyInvite();
  const reduced = useReducedMotion();
  const [downloading, setDownloading] = useState(false);

  if (error && !data) {
    return (
      <div className={cn("rounded-[var(--radius-panel)] border border-hairline p-6", className)}>
        <p className="text-text">Your invite link didn’t load.</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data) return <Skeleton className={cn("h-[13.5rem] w-full rounded-[var(--radius-panel)]", className)} />;

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.url);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Couldn’t copy. Select the link and copy it yourself.", tone: "error" });
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Reverie", text: "See how our tastes match on Reverie.", url: data!.url });
    } catch {
      // Closing the share sheet isn't an error worth a message.
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const token = await currentIdToken();
      const res = await fetch("/api/invite/card", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error();
      const href = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href, download: "reverie-invite.png" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      toast({ title: "The card didn’t download. Try again.", tone: "error" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className={cn(
        "grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center",
        !bare && "rounded-[var(--radius-panel)] border border-hairline p-5 sm:p-6",
        className,
      )}
    >
      <motion.div
        className="w-fit rounded-[6px] bg-[#ede6da] p-3.5 shadow-[0_18px_40px_rgb(0_0_0/0.35)]"
        initial={reduced ? false : { rotate: -3, y: 10, opacity: 0 }}
        animate={{ rotate: -1.5, y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: ease.out }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated SVG, no optimisation to do */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(data.qr.light)}`} alt="QR code for your invite link" width={132} height={132} className="size-[8.25rem]" />
      </motion.div>
      <div className="min-w-0">
        <p className="caption">Your invite link</p>
        <p className="mt-1.5 select-all break-all font-mono text-[0.875rem] text-text">{data.url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-2 text-meta text-muted">Whoever opens it gets a friend request ready for you, and sees how your tastes match.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={copy}>
            <Copy size={16} weight="light" aria-hidden="true" /> Copy link
          </Button>
          {canShare ? (
            <Button size="sm" variant="secondary" onClick={share}>
              <ShareNetwork size={16} weight="light" aria-hidden="true" /> Share
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={download} pending={downloading}>
            <DownloadSimple size={16} weight="light" aria-hidden="true" /> Download card
          </Button>
        </div>
      </div>
    </div>
  );
}
