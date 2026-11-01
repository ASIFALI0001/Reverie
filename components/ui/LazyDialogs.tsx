"use client";

import dynamic from "next/dynamic";

// Dialogs that only matter after a click. Their code (Radix dialog, vaul, the rating form) loads
// on first open, or a beat earlier when the pointer or focus reaches the button that opens them.

export const TrailerModal = dynamic(() => import("@/components/title/TrailerModal").then((m) => m.TrailerModal), { ssr: false });
export const LibrarySheet = dynamic(() => import("@/components/library/LibrarySheet").then((m) => m.LibrarySheet), { ssr: false });
export const SendToFriendSheet = dynamic(() => import("@/components/social/SendToFriend").then((m) => m.SendToFriendSheet), { ssr: false });
export const ShouldContinueSheet = dynamic(() => import("@/components/series/ShouldContinue").then((m) => m.ShouldContinueSheet), { ssr: false });

export function preloadSendSheet() {
  void import("@/components/social/SendToFriend");
}

export function preloadContinueSheet() {
  void import("@/components/series/ShouldContinue");
}

export function preloadTrailer() {
  void import("@/components/title/TrailerModal");
}

export function preloadLibrarySheet() {
  void import("@/components/library/LibrarySheet");
}
