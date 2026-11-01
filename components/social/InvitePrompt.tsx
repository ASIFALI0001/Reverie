"use client";

import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { InvitePanel } from "@/components/social/InvitePanel";
import { useMe, useUpdateMe } from "@/lib/api/me";
import { useTaste } from "@/lib/api/taste";
import { ease } from "@/lib/motion";

/**
 * Once, after onboarding (and once for people who were here before friends existed):
 * "Your Taste DNA is ready — compare with a friend?" with the invite card.
 */
export function InvitePrompt() {
  const { data: me } = useMe();
  const taste = useTaste();
  const update = useUpdateMe();
  const reduced = useReducedMotion();
  const due = me?.onboardingDone && me.handleChosen && !me.invitePromptSeen && taste.data?.status === "ready";
  if (!due) return null;

  const dismiss = () => update.mutate({ invitePromptSeen: true });
  return (
    <motion.section
      aria-labelledby="invite-prompt"
      className="page mt-8 md:mt-12"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: ease.out }}
    >
      <div className="grid grid-cols-1 gap-8 rounded-[6px] border border-hairline-strong bg-surface p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center md:p-8">
        <div>
          <p className="caption">New: friends</p>
          <h2 id="invite-prompt" className="mt-2 max-w-[16ch] font-display text-h3">
            Your Taste DNA is ready. Compare with a friend?
          </h2>
          <p className="mt-3 max-w-[42ch] text-muted">Send your link: when they join, you’ll both see how your tastes match, and what each of you loves.</p>
          <Button variant="ghost" className="-ml-5 mt-4" onClick={dismiss} pending={update.isPending}>
            Not now
          </Button>
        </div>
        <InvitePanel bare />
      </div>
    </motion.section>
  );
}
