"use client";

import { useState } from "react";
import { ToggleGroup } from "radix-ui";
import { Plus } from "@phosphor-icons/react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { RatingInput } from "@/components/ui/RatingInput";
import { Switch } from "@/components/ui/Switch";
import { useCreateShelf, useLibraryOverview, useRemoveFromLibrary, useSaveToLibrary, useUpdateLibraryItem } from "@/lib/api/library";
import { DIDNT, MAX_REACTIONS, REVIEW_MAX, WORKED } from "@/lib/library/reactions";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";
import type { LibraryStatus } from "@/lib/db/models/Library";
import type { MediaType } from "@/lib/catalog/types";

export type SheetTitle = { mediaType: MediaType; tmdbId: number; title: string };
export type SheetInitial = {
  status?: LibraryStatus;
  rating?: number | null;
  note?: string;
  worked?: string[];
  didnt?: string[];
  watchedAt?: string | null;
  customShelves?: string[];
  hiddenFromFriends?: boolean;
};

type ReactionState = { worked: string[]; didnt: string[]; note: string };

const STATUSES: { value: LibraryStatus; label: string }[] = [
  { value: "watched", label: "Watched" },
  { value: "watching", label: "Watching" },
  { value: "dropped", label: "Dropped" },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add to / edit in the library: status, half-star rating, date, what worked and what
 * didn't, a short review, and custom shelves. `onSaved` lets callers run the
 * fly-to-library flourish. The "review" mode asks only the after-watching questions,
 * for a title that's already in the library.
 */
export function LibrarySheet({
  open,
  onOpenChange,
  title,
  initial,
  editing = false,
  mode = "full",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: SheetTitle;
  initial?: SheetInitial;
  editing?: boolean;
  mode?: "full" | "review";
  onSaved?: () => void;
}) {
  const review = mode === "review";
  const done = () => onOpenChange(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={review ? `What did you think of ${title.title}?` : editing ? `Edit ${title.title}` : `Add ${title.title} to your library`}
      description={
        review
          ? "It’s in your library. A couple of taps tells Reverie why, and sharpens every match."
          : editing
            ? undefined
            : "Ratings sharpen every match Reverie makes for you."
      }
    >
      {/* Mounted fresh each time it opens, so the form always starts from the saved values. */}
      {open && review ? <ReviewBody title={title} initial={initial} onDone={done} /> : null}
      {open && !review ? <SheetBody title={title} initial={initial} editing={editing} onDone={done} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

/** What worked, what didn't (up to MAX_REACTIONS each), and an optional line in their own words. */
function ReactionFields({ value, onChange }: { value: ReactionState; onChange: (patch: Partial<ReactionState>) => void }) {
  const toggle = (list: string[], id: string, on: boolean) =>
    on ? (list.length >= MAX_REACTIONS || list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id);
  return (
    <div className="space-y-6">
      <ChipGroup legend="What worked?" options={WORKED} selected={value.worked} onToggle={(id, on) => onChange({ worked: toggle(value.worked, id, on) })} />
      <ChipGroup legend="What didn’t?" options={DIDNT} selected={value.didnt} onToggle={(id, on) => onChange({ didnt: toggle(value.didnt, id, on) })} />
      <label className="block">
        <span className="text-meta text-muted">In your own words (optional)</span>
        <textarea
          value={value.note}
          onChange={(e) => onChange({ note: e.target.value })}
          maxLength={REVIEW_MAX}
          rows={2}
          placeholder="What stayed with you? A line is plenty."
          className="mt-1.5 block w-full resize-none rounded-none border-0 border-b border-hairline-strong bg-transparent py-2 text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
        />
      </label>
    </div>
  );
}

function ChipGroup({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly (readonly [string, string])[];
  selected: string[];
  onToggle: (id: string, on: boolean) => void;
}) {
  const full = selected.length >= MAX_REACTIONS;
  return (
    <fieldset>
      <legend className="text-meta text-muted">{legend}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map(([id, label]) => {
          const on = selected.includes(id);
          return (
            <Chip key={id} selected={on} disabled={!on && full} onToggle={(next) => onToggle(id, next)}>
              {label}
            </Chip>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Just the after-watching questions, for a title that's already in the library. */
function ReviewBody({ title, initial, onDone }: { title: SheetTitle; initial?: SheetInitial; onDone: () => void }) {
  const update = useUpdateLibraryItem();
  const [reaction, setReaction] = useState<ReactionState>({ worked: initial?.worked ?? [], didnt: initial?.didnt ?? [], note: initial?.note ?? "" });
  const empty = !reaction.worked.length && !reaction.didnt.length && !reaction.note.trim();

  async function submit() {
    try {
      await update.mutateAsync({ mediaType: title.mediaType, tmdbId: title.tmdbId, ...reaction, note: reaction.note.trim() });
      onDone();
      toast({ title: "Saved. Your next matches will take it into account." });
    } catch (err) {
      toast({ title: "Couldn’t save that", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <ReactionFields value={reaction} onChange={(patch) => setReaction((r) => ({ ...r, ...patch }))} />
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Skip
        </Button>
        <Button onClick={submit} pending={update.isPending} disabled={empty}>
          Save
        </Button>
      </div>
    </div>
  );
}

function SheetBody({
  title,
  initial,
  editing,
  onDone,
  onSaved,
}: {
  title: SheetTitle;
  initial?: SheetInitial;
  editing: boolean;
  onDone: () => void;
  onSaved?: () => void;
}) {
  const save = useSaveToLibrary();
  const remove = useRemoveFromLibrary();
  const overview = useLibraryOverview();
  const createShelf = useCreateShelf();
  const [status, setStatus] = useState<LibraryStatus>(initial?.status ?? "watched");
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [watchedAt, setWatchedAt] = useState(initial?.watchedAt?.slice(0, 10) ?? today());
  const [reaction, setReaction] = useState<ReactionState>({ worked: initial?.worked ?? [], didnt: initial?.didnt ?? [], note: initial?.note ?? "" });
  const [shelves, setShelves] = useState<string[]>(initial?.customShelves ?? []);
  const [newShelf, setNewShelf] = useState("");
  const [hidden, setHidden] = useState(initial?.hiddenFromFriends ?? false);

  async function submit() {
    try {
      await save.mutateAsync({
        mediaType: title.mediaType,
        tmdbId: title.tmdbId,
        status,
        rating,
        ...reaction,
        note: reaction.note.trim(),
        watchedAt: status === "watching" ? null : new Date(`${watchedAt}T12:00:00`).toISOString(),
        customShelves: shelves,
        hiddenFromFriends: hidden,
      });
      onDone();
      onSaved?.();
      toast({ title: editing ? "Saved" : `Added ${title.title} to your library` });
    } catch (err) {
      toast({ title: "Couldn’t save that", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  async function removeIt() {
    try {
      await remove.mutateAsync({ mediaType: title.mediaType, tmdbId: title.tmdbId });
      onDone();
      toast({ title: `Removed ${title.title} from your library` });
    } catch (err) {
      toast({ title: "Couldn’t remove that", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  async function addShelf() {
    const name = newShelf.trim();
    if (!name) return;
    try {
      const shelf = await createShelf.mutateAsync(name);
      setShelves((s) => [...s, shelf.id]);
      setNewShelf("");
    } catch (err) {
      toast({ title: "Couldn’t create that shelf", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <ToggleGroup.Root
        type="single"
        value={status}
        onValueChange={(v) => v && setStatus(v as LibraryStatus)}
        aria-label="Status"
        className="grid grid-cols-3 rounded-full border border-hairline-strong p-1"
      >
        {STATUSES.map((s) => (
          <ToggleGroup.Item
            key={s.value}
            value={s.value}
            className={cn(
              "h-9 rounded-full text-[0.9375rem] transition-colors duration-200",
              status === s.value ? "bg-text text-bg" : "text-muted hover:text-text",
            )}
          >
            {s.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div>
        <p className="text-meta text-muted">{status === "watching" ? "So far" : "Your rating"}</p>
        <RatingInput className="mt-3" value={rating} onChange={setRating} />
      </div>

      {status !== "watching" ? (
        <label className="block">
          <span className="text-meta text-muted">{status === "dropped" ? "Stopped on" : "Watched on"}</span>
          <input
            type="date"
            value={watchedAt}
            max={today()}
            onChange={(e) => setWatchedAt(e.target.value || today())}
            className="mt-1.5 block h-11 w-full rounded-none border-0 border-b border-hairline-strong bg-transparent text-text outline-none [color-scheme:inherit] focus-visible:border-[var(--tint)]"
          />
        </label>
      ) : null}

      {/* Finished (or given up on): ask what worked and what didn't. */}
      {status !== "watching" ? <ReactionFields value={reaction} onChange={(patch) => setReaction((r) => ({ ...r, ...patch }))} /> : null}

      <div>
        <p className="text-meta text-muted">Your shelves</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(overview.data?.custom ?? []).map((s) => (
            <Chip key={s.id} selected={shelves.includes(s.id)} onToggle={(on) => setShelves((cur) => (on ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}>
              {s.name}
            </Chip>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addShelf();
            }}
            className="flex h-9 items-center gap-1 rounded-full border border-dashed border-hairline-strong pl-3 pr-1"
          >
            <input
              value={newShelf}
              onChange={(e) => setNewShelf(e.target.value)}
              maxLength={40}
              placeholder="New shelf"
              aria-label="New shelf name"
              className="w-28 bg-transparent text-[0.875rem] outline-none placeholder:text-faint"
            />
            <button type="submit" aria-label="Create shelf" className="grid size-7 place-items-center rounded-full text-muted hover:text-text">
              <Plus size={14} weight="light" />
            </button>
          </form>
        </div>
      </div>

      <Switch
        checked={hidden}
        onChange={setHidden}
        label="Hide from friends"
        description="Friends never see it, and it’s left out of anything they or your Taste Twins see."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {editing ? (
          <Button variant="ghost" className="px-0 text-danger hover:text-danger" onClick={removeIt} pending={remove.isPending}>
            Remove from library
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={submit} pending={save.isPending}>
          {editing ? "Save changes" : "Add to library"}
        </Button>
      </div>
    </div>
  );
}
