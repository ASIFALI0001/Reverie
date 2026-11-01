"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ME_QUERY_KEY, useAuth } from "@/components/auth/AuthProvider";
import { Avatar, TINT_HEX } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { HandleField } from "@/components/social/HandleField";
import { ServicesPicker } from "@/components/settings/ServicesPicker";
import { Switch } from "@/components/ui/Switch";
import { TasteDnaCard } from "@/components/taste/TasteDnaCard";
import { useMe, useUpdateMe, type MePatch } from "@/lib/api/me";
import { TASTE_QUERY_KEY, useTaste } from "@/lib/api/taste";
import { useOnboarding } from "@/lib/store/onboarding";
import { api, ApiClientError } from "@/lib/api/client";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";
import type { WatchRegion } from "@/lib/catalog/regions";
import type { AvatarTint } from "@/lib/avatar";
import type { PublicUser } from "@/lib/db/models/User";

const LANGUAGES = ["en", "hi", "ta", "te", "ml", "kn", "bn", "mr", "ja", "ko", "zh", "es", "fr", "de", "it", "pt"];

export function SettingsView({ regions }: { regions: WatchRegion[] }) {
  return (
    <div className="page pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <h1 className="text-h1">Settings</h1>
      <AuthGuard fallback={<SettingsSkeleton />}>
        <SettingsBody regions={regions} />
      </AuthGuard>
    </div>
  );
}

function Section({ id, title, lede, children }: { id?: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid-editorial scroll-mt-[calc(var(--nav-h)+1.5rem)] gap-y-6 border-t border-hairline py-10 md:py-14">
      <div className="col-span-12 md:col-span-4">
        <h2 className="text-h4">{title}</h2>
        {lede ? <p className="mt-2 max-w-[32ch] text-meta text-muted">{lede}</p> : null}
      </div>
      <div className="col-span-12 md:col-span-7 md:col-start-6">{children}</div>
    </section>
  );
}

function SettingsBody({ regions }: { regions: WatchRegion[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { data: me, isLoading, error } = useMe();
  const update = useUpdateMe();

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const languageNames = useMemo(() => new Intl.DisplayNames(["en"], { type: "language" }), []);

  if (isLoading || !me) {
    if (error) return <p className="mt-10 text-danger">Couldn’t load your settings. Refresh to try again.</p>;
    return <SettingsSkeleton />;
  }

  async function quickSave(patch: Parameters<typeof update.mutateAsync>[0], title: string) {
    try {
      await update.mutateAsync(patch);
      toast({ title });
    } catch (err) {
      toast({ title: "Couldn’t save that change", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  async function resetTasteProfile() {
    setResetting(true);
    try {
      await api("/api/taste/reset", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.removeQueries({ queryKey: TASTE_QUERY_KEY });
      useOnboarding.getState().reset();
      setResetOpen(false);
      router.push("/onboarding?rerun=1");
    } catch (err) {
      toast({ title: "Couldn’t reset your taste profile", description: err instanceof ApiClientError ? err.message : undefined, tone: "error" });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mt-10 md:mt-16">
      {/* Keyed on the saved values: the form starts from them, and resets if they change elsewhere. */}
      <ProfileSection key={`${me.displayName}|${me.avatar.kind}|${me.avatar.tint}`} me={me} />


      <Section title="Where you watch" lede="Your region decides which streaming services we show. Languages shape your matches.">
        <label htmlFor="region" className="text-meta text-muted">
          Region
        </label>
        <select
          id="region"
          value={me.region}
          onChange={(e) => quickSave({ region: e.target.value }, "Region updated")}
          className="mt-1.5 block h-12 w-full max-w-md cursor-pointer rounded-none border-0 border-b border-hairline-strong bg-transparent text-[1.0625rem] text-text outline-none focus-visible:border-[var(--tint)]"
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code} className="bg-surface text-text">
              {r.name}
            </option>
          ))}
        </select>
        <p className="mt-8 text-meta text-muted">Languages you’re happy to watch in</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LANGUAGES.map((code) => {
            const on = me.languages.includes(code);
            return (
              <Chip
                key={code}
                selected={on}
                onToggle={(next) => {
                  const langs = next ? [...me.languages, code] : me.languages.filter((l) => l !== code);
                  if (langs.length === 0) return toast({ title: "Keep at least one language" });
                  void quickSave({ languages: langs }, "Languages updated");
                }}
              >
                {languageNames.of(code) ?? code}
              </Chip>
            );
          })}
        </div>
      </Section>

      <Section id="services" title="My services" lede="The streaming services you have. Mood Search can stick to what’s on them.">
        <ServicesPicker selected={me.services} />
      </Section>

      <PrivacySection me={me} save={quickSave} />

      <Section id="taste" title="Your taste" lede="Reverie learns from onboarding, your ratings and your library.">
        <TasteBlock />
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/onboarding?rerun=1" onClick={() => useOnboarding.getState().reset()}>
              Retake the taste quiz
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => setResetOpen(true)}>
            Reset taste profile
          </Button>
        </div>
        <Dialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset your taste profile?"
          description="Reverie forgets what it learned from onboarding and starts fresh. Your library, ratings and watchlist stay, and will start shaping matches again straight away."
        >
          <div className="mt-8 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Keep it
            </Button>
            <Button onClick={resetTasteProfile} pending={resetting}>
              Reset and re-run onboarding
            </Button>
          </div>
        </Dialog>
      </Section>

      <Section title="Account">
        <dl>
          <dt className="text-meta text-muted">Email</dt>
          <dd className="mt-1">{user?.email ?? me.email}</dd>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
          <DeleteAccount />
        </div>
      </Section>
    </div>
  );
}

function ProfileSection({ me }: { me: PublicUser }) {
  const update = useUpdateMe();
  const [name, setName] = useState(me.displayName ?? "");
  const [tint, setTint] = useState<AvatarTint>(me.avatar.tint);
  const [kind, setKind] = useState<"photo" | "monogram">(me.avatar.kind);
  const dirty = name.trim() !== (me.displayName ?? "") || tint !== me.avatar.tint || kind !== me.avatar.kind;

  async function save() {
    try {
      await update.mutateAsync({ displayName: name.trim(), avatar: { kind, tint } });
      toast({ title: "Profile saved" });
    } catch (err) {
      toast({ title: "Couldn’t save your profile", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  return (
    <Section title="Profile" lede="How you appear on your shelves.">
      <div className="flex flex-wrap items-center gap-6">
        <Avatar name={name || me.displayName} photoURL={me.photoURL} avatar={{ kind, tint }} size={72} />
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Monogram colour">
            {(Object.entries(TINT_HEX) as [AvatarTint, string][]).map(([key, hex]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={kind === "monogram" && tint === key}
                aria-label={`${key} monogram`}
                onClick={() => {
                  setKind("monogram");
                  setTint(key);
                }}
                className={cn(
                  "size-7 rounded-full ring-offset-2 ring-offset-bg transition-transform duration-150 hover:scale-110",
                  kind === "monogram" && tint === key && "ring-2 ring-text",
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
          {me.photoURL ? (
            <button
              type="button"
              onClick={() => setKind(kind === "photo" ? "monogram" : "photo")}
              className="link-draw text-meta text-muted hover:text-text"
            >
              {kind === "photo" ? "Use a monogram instead" : "Use my Google photo"}
            </button>
          ) : null}
        </div>
      </div>
      <Field className="mt-8 max-w-md" label="Display name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <Button className="mt-6" onClick={save} disabled={!dirty || !name.trim()} pending={update.isPending}>
        Save changes
      </Button>
      <HandleField key={me.handle ?? ""} current={me.handle} />
    </Section>
  );
}

const FRIENDS_SEE = [
  { value: "everything", label: "Everything", description: "Your library, ratings, watchlist and activity." },
  { value: "ratings", label: "Ratings only", description: "What you rated, and how. Not your watchlist or activity." },
  { value: "nothing", label: "Nothing", description: "Just your name, handle and Taste DNA. Your taste match still works." },
] as const;

/** Who sees what. Saved as you choose; the server enforces every rule, the page only shows them. */
function PrivacySection({ me, save }: { me: PublicUser; save: (patch: MePatch, title: string) => Promise<void> }) {
  // The choice moves the moment it's clicked; if the save fails, the saved value comes back.
  const [friendsSee, setFriendsSee] = useState(me.privacy.friendsSee);
  const [saved, setSaved] = useState(me.privacy.friendsSee);
  if (me.privacy.friendsSee !== saved) {
    setSaved(me.privacy.friendsSee);
    setFriendsSee(me.privacy.friendsSee);
  }
  return (
    <Section id="privacy" title="Privacy" lede="Friends only see what you allow. Titles you hide from friends stay yours, whatever you pick here.">
      <fieldset>
        <legend className="text-meta text-muted">What friends can see</legend>
        <div className="mt-3 space-y-2">
          {FRIENDS_SEE.map((o) => {
            const on = friendsSee === o.value;
            return (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-start gap-4 rounded-[var(--radius-panel)] border px-4 py-3.5 transition-colors duration-200",
                  on ? "border-text/45 bg-text/[0.04]" : "border-hairline hover:border-hairline-strong",
                )}
              >
                <input
                  type="radio"
                  name="friends-see"
                  value={o.value}
                  checked={on}
                  onChange={() => {
                    setFriendsSee(o.value);
                    void save({ privacy: { friendsSee: o.value } }, `Friends can see ${o.label.toLowerCase()}`);
                  }}
                  className="mt-1.5 size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block text-[1.0625rem]">{o.label}</span>
                  <span className="mt-0.5 block text-meta text-muted">{o.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-10 space-y-8">
        <Switch
          checked={me.privacy.inTwins}
          onChange={(v) => void save({ privacy: { inTwins: v } }, v ? "You’re in Taste Twins" : "You’ve left Taste Twins")}
          label="Include me in Taste Twins"
          description="Reverie introduces you, anonymously, to people whose taste is close to yours. Hidden titles are never used."
        />
        <Switch
          checked={me.privacy.searchable}
          onChange={(v) => void save({ privacy: { searchable: v } }, v ? "People can find you in search" : "You’re hidden from search")}
          label="Let people find me in search"
          description="By name or @handle. Your invite link works either way."
        />
      </div>
      <p className="mt-10 max-w-[52ch] text-meta text-muted">
        Administrators can see account data, including hidden titles, for moderation and support.{" "}
        <Link href="/privacy" className="link-draw text-text">
          Privacy policy
        </Link>
      </p>
    </Section>
  );
}

/** The current Taste DNA, or a nudge toward building one. */
function TasteBlock() {
  const taste = useTaste();
  if (taste.isPending) return <Skeleton className="h-56 w-full" />;
  const view = taste.data;
  if (!view || view.status === "none" || !view.dna.length) {
    return <p className="max-w-[52ch] text-muted">No taste profile yet. Take the quiz, or rate a few titles in your library and it will build itself.</p>;
  }
  return (
    <div>
      <TasteDnaCard view={view} compact animate={false} />
      <p className="mt-4 text-meta text-muted">
        Built from <span className="numeral text-text">{view.signalCount}</span> title{view.signalCount === 1 ? "" : "s"} you’ve rated, swiped or saved. It updates as you go.{" "}
        <Link href="/taste" className="link-draw text-text">
          See how it’s moved over time
        </Link>
      </p>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-10 space-y-14 md:mt-16">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid-editorial gap-y-6 border-t border-hairline pt-10">
          <Skeleton className="col-span-12 h-7 w-40 md:col-span-3" />
          <div className="col-span-12 space-y-4 md:col-span-7 md:col-start-6">
            <Skeleton className="h-12 w-full max-w-md" />
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
