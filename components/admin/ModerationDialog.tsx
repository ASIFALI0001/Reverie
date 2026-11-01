"use client";

import { useId, useState } from "react";
import { ToggleGroup } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PasswordField } from "@/components/auth/PasswordField";
import { FormError } from "@/components/auth/shared";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { useReauth } from "@/components/admin/useReauth";
import { useModerateUser, type ModerationInput } from "@/lib/api/admin";
import { blockUntil, type BlockLength } from "@/lib/admin/format";
import { ApiClientError } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";

export type ModerationTarget = { uid: string; name: string | null; email: string | null };

type Length = BlockLength;

const LENGTHS: { value: Length; label: string }[] = [
  { value: "open", label: "Until I lift it" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "date", label: "Until a date" },
];

const DAY = 86_400_000;
const REASON_MIN = 3;
const REASON_MAX = 500;

const localDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const reauthMessage = (err: unknown) => {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/invalid-login-credentials") return "That password isn’t right.";
  return authErrorMessage(err);
};

/**
 * Block or unblock one account. The reason is required (it goes in the audit log); a block can
 * show it to the person and can end on its own. Moderation needs a sign-in from the last
 * 30 minutes: when the server asks, the dialog confirms it's you and sends the request again.
 */
export function ModerationDialog({
  target,
  mode,
  open,
  onOpenChange,
}: {
  target: ModerationTarget;
  mode: "block" | "unblock";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ids = useId();
  const moderate = useModerateUser();
  const { usesPassword, reauth } = useReauth();
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [length, setLength] = useState<Length>("open");
  const [date, setDate] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const who = target.name ?? target.email ?? "this account";
  const blocking = mode === "block";
  const ready = reason.trim().length >= REASON_MIN && (!blocking || length !== "date" || Boolean(date));

  function close() {
    onOpenChange(false);
    reset();
  }

  function reset() {
    setReason("");
    setShowReason(false);
    setLength("open");
    setDate("");
    setStep("form");
    setPassword("");
    setError(null);
  }

  async function send(token?: string) {
    setError(null);
    const input: ModerationInput = blocking
      ? { uid: target.uid, action: "block", body: { reason: reason.trim(), showReason, until: blockUntil(length, date) }, token }
      : { uid: target.uid, action: "unblock", body: { reason: reason.trim() }, token };
    try {
      await moderate.mutateAsync(input);
      toast({
        title: blocking ? `${who} is blocked` : `${who} is unblocked`,
        description: blocking ? "Their sessions have been ended." : "They can use Reverie again.",
      });
      close();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "reauth_required") {
        setStep("confirm");
        return;
      }
      setError(err instanceof Error ? err.message : "That didn’t go through. Try again.");
    }
  }

  async function confirmAndSend() {
    setError(null);
    setConfirming(true);
    try {
      const token = await reauth(password);
      setStep("form");
      setPassword("");
      await send(token);
    } catch (err) {
      setError(reauthMessage(err));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={step === "confirm" ? "Confirm it’s you" : blocking ? `Block ${who}?` : `Unblock ${who}?`}
      description={
        step === "confirm"
          ? "Moderation needs a recent sign-in. Confirm, and the request goes through straight after."
          : blocking
            ? "They keep their data, but every page shows them the blocked notice and their sessions end."
            : "They can sign in and use everything again straight away."
      }
    >
      {step === "confirm" ? (
        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmAndSend();
          }}
        >
          {usesPassword ? (
            <PasswordField label="Your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          ) : (
            <p className="text-meta text-muted">You’ll confirm with Google in a pop-up.</p>
          )}
          <FormError message={error} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setStep("form")}>
              Back
            </Button>
            <Button type="submit" variant={blocking ? "danger" : "primary"} disabled={usesPassword && !password} pending={confirming || moderate.isPending}>
              {usesPassword ? "Confirm" : "Continue with Google"}
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="mt-8 space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void send();
          }}
        >
          <div>
            <label htmlFor={`${ids}-reason`} className="text-meta text-muted">
              {blocking ? "Reason" : "Why you’re lifting it"}
            </label>
            <textarea
              id={`${ids}-reason`}
              aria-describedby={`${ids}-reason-hint`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REASON_MAX}
              rows={2}
              required
              placeholder={blocking ? "What happened? A sentence is plenty." : "Appeal accepted, mistake, served its time…"}
              className="mt-1.5 block w-full resize-none rounded-none border-0 border-b border-hairline-strong bg-transparent py-2 text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
            />
            <p id={`${ids}-reason-hint`} className="mt-1.5 text-meta text-muted">
              Kept in the audit log.
            </p>
          </div>

          {blocking ? (
            <>
              <div className="flex items-start gap-3">
                <input
                  id={`${ids}-show`}
                  type="checkbox"
                  checked={showReason}
                  onChange={(e) => setShowReason(e.target.checked)}
                  aria-describedby={`${ids}-show-hint`}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <div>
                  <label htmlFor={`${ids}-show`} className="block text-[0.9375rem]">
                    Show them the reason
                  </label>
                  <p id={`${ids}-show-hint`} className="text-meta text-muted">
                    On their blocked page. Otherwise they only see that the account is blocked.
                  </p>
                </div>
              </div>

              <div>
                <p id={`${ids}-length`} className="text-meta text-muted">
                  How long
                </p>
                <ToggleGroup.Root
                  type="single"
                  value={length}
                  onValueChange={(v) => v && setLength(v as Length)}
                  aria-labelledby={`${ids}-length`}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {LENGTHS.map((l) => (
                    <ToggleGroup.Item
                      key={l.value}
                      value={l.value}
                      className={cn(
                        "h-9 rounded-full border px-4 text-[0.875rem] transition-[background-color,color,border-color] duration-200",
                        length === l.value ? "border-text bg-text text-bg" : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
                      )}
                    >
                      {l.label}
                    </ToggleGroup.Item>
                  ))}
                </ToggleGroup.Root>
                {length === "date" ? (
                  <label className="mt-4 block">
                    <span className="text-meta text-muted">Ends at the end of</span>
                    <input
                      type="date"
                      value={date}
                      min={localDate(Date.now() + DAY)}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1.5 block h-11 w-full rounded-none border-0 border-b border-hairline-strong bg-transparent text-text outline-none [color-scheme:inherit] focus-visible:border-[var(--tint)]"
                    />
                  </label>
                ) : null}
              </div>
            </>
          ) : null}

          <FormError message={error} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant={blocking ? "danger" : "primary"} disabled={!ready} pending={moderate.isPending}>
              {blocking ? "Block account" : "Unblock account"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
