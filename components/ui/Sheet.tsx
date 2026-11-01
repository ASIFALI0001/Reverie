"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { Dialog } from "@/components/ui/Dialog";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/** A centred panel on desktop, a thumb-friendly bottom drawer on phones. */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  const desktop = useMediaQuery("(min-width: 768px)");
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
        {children}
      </Dialog>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-bg/70" />
        <Drawer.Content
          data-lenis-prevent
          className="fixed inset-x-0 bottom-0 z-[81] flex max-h-[92dvh] flex-col rounded-t-[14px] border-t border-hairline-strong bg-surface pb-[env(safe-area-inset-bottom,0px)] focus-visible:outline-none"
        >
          <Drawer.Handle className="mx-auto mt-3 h-1 w-10 rounded-full bg-hairline-strong" />
          <div className="overflow-y-auto px-5 pb-6 pt-4">
            <Drawer.Title className="font-display text-h4">{title}</Drawer.Title>
            {description ? <Drawer.Description className="mt-2 text-muted">{description}</Drawer.Description> : null}
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
