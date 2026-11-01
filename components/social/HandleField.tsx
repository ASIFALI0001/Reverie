"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useHandleCheck, useSetHandle } from "@/lib/api/social";
import { HANDLE_MAX, handleProblem, normalizeHandle } from "@/lib/social/handles";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";

/** Settings: change your @handle, with a live "is it free?" as you type. */
export function HandleField({ current }: { current: string | null }) {
  const [text, setText] = useState(current ?? "");
  const [debounced, setDebounced] = useState(text);
  const save = useSetHandle();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const handle = normalizeHandle(text);
  const changed = handle !== (current ?? "");
  const local = changed ? handleProblem(handle) : null;
  const check = useHandleCheck(local || !changed ? "" : debounced, current);
  const checking = changed && !local && (normalizeHandle(debounced) !== handle || check.isFetching);
  const problem = local ?? (changed && check.data?.handle === handle ? check.data.problem : null);
  const ok = changed && !local && check.data?.handle === handle && check.data.available;

  return (
    <form
      className="mt-8 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        save.mutate(handle, {
          onSuccess: ({ handle: saved }) => toast({ title: `You’re @${saved}`, description: "Your profile link changed with it." }),
          onError: (err) => toast({ title: "Couldn’t change your handle", description: err instanceof Error ? err.message : undefined, tone: "error" }),
        });
      }}
    >
      <label htmlFor="settings-handle" className="text-meta text-muted">
        Handle
      </label>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex flex-1 items-center border-b border-hairline-strong focus-within:border-[var(--tint)]">
          <span aria-hidden="true" className="text-[1.0625rem] text-muted">
            @
          </span>
          <input
            id="settings-handle"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/^@+/, ""))}
            maxLength={HANDLE_MAX}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={problem ? true : undefined}
            aria-describedby="settings-handle-hint"
            className="h-12 w-full bg-transparent pl-0.5 text-[1.0625rem] text-text outline-none"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={!ok || checking} pending={save.isPending}>
          Change
        </Button>
      </div>
      <p id="settings-handle-hint" role="status" className={cn("mt-2 min-h-[1.25rem] text-meta", problem ? "text-danger" : "text-muted")}>
        {problem ?? (checking ? "Checking…" : ok ? `@${handle} is free.` : "How friends find you. Letters, numbers, underscores and dots.")}
      </p>
    </form>
  );
}
