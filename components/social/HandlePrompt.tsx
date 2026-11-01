"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useMe } from "@/lib/api/me";
import { useHandleCheck, useSetHandle } from "@/lib/api/social";
import { HANDLE_MAX, handleProblem, normalizeHandle } from "@/lib/social/handles";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";

/** Pages where a dialog would get in the way: mid-onboarding, an invite, account states. */
const QUIET = [/^\/onboarding/, /^\/invite\//, /^\/blocked/, /^\/sign/, /^\/forgot/];

/**
 * Once per account: everyone gets a provisional @handle from their name; this asks them to keep
 * it or pick another. Closing it keeps the suggestion, so it never comes back.
 */
export function HandlePrompt() {
  const { status } = useAuth();
  const { data: me } = useMe();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const due = status === "signed-in" && me != null && me.onboardingDone && !me.handleChosen && me.handle != null && !QUIET.some((r) => r.test(pathname));

  // Let the page arrive first.
  useEffect(() => {
    if (!due) return;
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, [due]);

  if (!due || !ready || !me?.handle) return null;
  return <HandleDialog current={me.handle} />;
}

function HandleDialog({ current }: { current: string }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState(current);
  const [debounced, setDebounced] = useState(current);
  const save = useSetHandle();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const handle = normalizeHandle(text);
  const local = handleProblem(handle);
  const check = useHandleCheck(local ? "" : debounced, current);
  const checking = handle !== current && !local && (normalizeHandle(debounced) !== handle || check.isFetching);
  const problem = local ?? (handle !== current && check.data?.handle === handle ? check.data.problem : null);
  const ok = !local && (handle === current || (check.data?.handle === handle && check.data.available));

  function keep(h: string, quiet = false) {
    save.mutate(h, {
      onSuccess: ({ handle: saved }) => {
        setOpen(false);
        toast({ title: `You’re @${saved}`, description: quiet ? "Change it any time in Settings." : "Friends can find you by it." });
      },
      onError: (err) => toast({ title: "Couldn’t save that handle", description: err instanceof Error ? err.message : undefined, tone: "error" }),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Closing keeps the suggestion: a handle is needed for friends, and asking twice is nagging.
        if (!o && !save.isPending) keep(current, true);
      }}
      title="Pick your handle"
      description="It’s how friends find you, and your profile’s address. You can change it later."
    >
      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) keep(handle);
        }}
      >
        <label htmlFor="handle-input" className="text-meta text-muted">
          Handle
        </label>
        <div className="relative mt-1.5 flex items-center border-b border-hairline-strong focus-within:border-[var(--tint)]">
          <span aria-hidden="true" className="text-[1.0625rem] text-muted">
            @
          </span>
          <input
            id="handle-input"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/^@+/, ""))}
            maxLength={HANDLE_MAX}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={problem ? true : undefined}
            aria-describedby="handle-hint"
            className="h-12 w-full bg-transparent pl-0.5 text-[1.0625rem] text-text outline-none"
          />
        </div>
        <p id="handle-hint" role="status" className={cn("mt-2 min-h-[1.25rem] text-meta", problem ? "text-danger" : "text-muted")}>
          {problem ?? (checking ? "Checking…" : ok ? (handle === current ? "We picked this one from your name." : `@${handle} is free.`) : "Letters, numbers, underscores and dots.")}
        </p>
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          {handle !== current ? (
            <Button variant="ghost" onClick={() => setText(current)}>
              Back to @{current}
            </Button>
          ) : null}
          <Button type="submit" disabled={!ok || checking} pending={save.isPending}>
            {handle === current ? `Keep @${current}` : `Use @${handle}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
