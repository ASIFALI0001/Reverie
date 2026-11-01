"use client";

import { useState } from "react";
import { Heart, MagnifyingGlass } from "@phosphor-icons/react";
import { Button, IconButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Slider } from "@/components/ui/Slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { toast } from "@/lib/store/toast";

const MOODS = ["Slow-burn", "Mind-bending", "Dark", "Feel-good", "Epic", "Mystery", "Sci-fi", "Romance"];

export function Playground() {
  const [picked, setPicked] = useState<string[]>(["Slow-burn", "Mind-bending"]);
  const [pace, setPace] = useState(32);
  const [open, setOpen] = useState(false);
  const [loved, setLoved] = useState(false);
  const [rating, setRating] = useState(8);

  return (
    <div className="grid-editorial gap-y-16">
      <div className="col-span-12 space-y-6 md:col-span-6">
        <h3 className="caption">Actions</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Create your account</Button>
          <Button variant="secondary">Sign in</Button>
          <Button variant="accent">See your matches</Button>
          <Button variant="ghost">Skip for now</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary">
            Small
          </Button>
          <Button size="lg">Large</Button>
          <IconButton aria-label={loved ? "Remove from loved" : "Mark as loved"} aria-pressed={loved} onClick={() => setLoved((v) => !v)}>
            <Heart size={20} weight={loved ? "fill" : "light"} className={loved ? "text-accent" : undefined} />
          </IconButton>
          <IconButton aria-label="Search">
            <MagnifyingGlass size={20} weight="light" />
          </IconButton>
          <span className="flex items-center gap-1.5 text-meta text-muted">
            Open the palette <Kbd>⌘K</Kbd>
          </span>
        </div>
      </div>

      <div className="col-span-12 space-y-6 md:col-span-6">
        <h3 className="caption">What pulls you in</h3>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip
              key={m}
              selected={picked.includes(m)}
              onToggle={(on) => setPicked((p) => (on ? [...p, m] : p.filter((x) => x !== m)))}
            >
              {m}
            </Chip>
          ))}
        </div>
      </div>

      <div className="col-span-12 space-y-8 md:col-span-6">
        <h3 className="caption">Fields</h3>
        <Field label="Email" type="email" placeholder="you@example.com" autoComplete="email" />
        <Field label="Password" type="password" error="Use at least 8 characters." defaultValue="short" />
      </div>

      <div className="col-span-12 space-y-8 md:col-span-6">
        <h3 className="caption">Sliders</h3>
        <Slider value={pace} onValueChange={setPace} minLabel="Slow-burn" maxLabel="Fast and loud" label="Pace" bipolar />
        <Slider value={70} onValueChange={() => {}} minLabel="Easy watch" maxLabel="Make me think" label="Complexity" />
      </div>

      <div className="col-span-12 md:col-span-6">
        <Tabs defaultValue="edits">
          <TabsList label="Videos">
            <TabsTrigger value="trailers" count={3}>
              Trailers
            </TabsTrigger>
            <TabsTrigger value="edits" count={8}>
              Edits
            </TabsTrigger>
            <TabsTrigger value="reviews" count={5}>
              Reviews
            </TabsTrigger>
            <TabsTrigger value="explained" count={2}>
              Explained
            </TabsTrigger>
          </TabsList>
          {["trailers", "edits", "reviews", "explained"].map((v) => (
            <TabsContent key={v} value={v} className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="aspect-video" />
                <Skeleton className="aspect-video" />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="col-span-12 space-y-6 md:col-span-6">
        <h3 className="caption">Feedback</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              toast({ title: "Added to your library", description: "Metropolis · Sci-fi shelf", action: { label: "Undo", onClick: () => {} } })
            }
          >
            Show a toast
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: "Couldn’t reach TMDB", description: "Showing cached details.", tone: "error" })}>
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Open a dialog
          </Button>
        </div>
        <div className="flex items-start gap-4">
          <Skeleton className="aspect-[2/3] w-24" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen} title="Rate Metropolis" description="How did it land? Your rating sharpens every match.">
        <div className="mt-8 space-y-6">
          <Slider value={rating} onValueChange={setRating} min={1} max={10} step={0.5} minLabel="1" maxLabel="10" label="Rating" />
          <p className="numeral text-center text-h3 font-light">{rating.toFixed(1)}</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Save rating</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
