import { z } from "zod";
import { LIBRARY_STATUSES } from "@/lib/db/models/Library";
import { DIDNT_IDS, MAX_REACTIONS, WORKED_IDS } from "@/lib/library/reactions";

/** 1–10 in half-star steps (whole numbers; a half star is one point). */
export const Rating = z.number().int().min(1).max(10).nullable();

export const LibraryFields = z
  .object({
    status: z.enum(LIBRARY_STATUSES).optional(),
    rating: Rating.optional(),
    note: z.string().max(2000).optional(),
    worked: z.array(z.enum(WORKED_IDS)).max(MAX_REACTIONS).optional(),
    didnt: z.array(z.enum(DIDNT_IDS)).max(MAX_REACTIONS).optional(),
    watchedAt: z.iso.datetime().nullable().optional(),
    rewatchCount: z.number().int().min(0).max(999).optional(),
    customShelves: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(50).optional(),
    /** Never shown to friends or used in anything friends or twins see. */
    hiddenFromFriends: z.boolean().optional(),
  })
  .strict();

export const Category = z.enum(["movie", "series", "anime", "cartoon"]);
