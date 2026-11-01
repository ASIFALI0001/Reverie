"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { FormError } from "@/components/auth/shared";
import { authSdk } from "@/lib/auth/firebase-client";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";

const CONFIRM_WORD = "DELETE";

export function DeleteAccount() {
  const { user, ensureAuth, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const usesPassword = user?.providerData.some((p) => p.providerId === "password") ?? false;
  const ready = confirm.trim().toUpperCase() === CONFIRM_WORD && (!usesPassword || password.length > 0);

  async function deleteForever() {
    if (!user) return;
    setError(null);
    setPending(true);
    try {
      const [auth, sdk] = await Promise.all([ensureAuth(), authSdk()]);
      const current = auth.currentUser ?? user;
      // Prove it's really you, right now.
      if (usesPassword) {
        await sdk.reauthenticateWithCredential(current, sdk.EmailAuthProvider.credential(current.email ?? "", password));
      } else {
        await sdk.reauthenticateWithPopup(current, new sdk.GoogleAuthProvider());
      }
      const token = await current.getIdToken(true);
      await api("/api/users/me", { method: "DELETE", token });
      setOpen(false);
      toast({ title: "Your account was deleted", description: "Everything Reverie stored about you is gone." });
      await signOut();
    } catch (err) {
      setError(authErrorMessage(err) ?? (err instanceof Error ? err.message : "Couldn’t delete your account."));
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete account…
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setConfirm("");
            setPassword("");
            setError(null);
          }
        }}
        title="Delete your account?"
        description="This permanently removes your library, watchlist, ratings and taste profile. It can’t be undone."
      >
        <div className="mt-8 space-y-6">
          <Field
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={confirm}
            autoComplete="off"
            onChange={(e) => setConfirm(e.target.value)}
          />
          {usesPassword ? (
            <PasswordField
              label="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : (
            <p className="text-meta text-muted">You’ll confirm with Google in a pop-up.</p>
          )}
          <FormError message={error} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteForever} disabled={!ready} pending={pending}>
              Delete my account
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
