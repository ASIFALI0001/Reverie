"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthProvider";

const HandlePrompt = dynamic(() => import("@/components/social/HandlePrompt").then((m) => m.HandlePrompt), { ssr: false });

/** Site-wide social moments for signed-in people (visitors never download them). */
export function SocialLayer() {
  const { status } = useAuth();
  return status === "signed-in" ? <HandlePrompt /> : null;
}
