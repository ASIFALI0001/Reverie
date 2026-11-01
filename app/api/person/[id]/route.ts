import { z } from "zod";
import { route } from "@/lib/http/route";
import { notFound } from "@/lib/http/errors";
import { getPersonPage } from "@/lib/person-page";

const Input = z.object({ id: z.coerce.number().int().positive() });

/** GET /api/person/:id — a person's details and filmography (from TMDB, cached for days). */
export const GET = route({ input: Input, rateLimit: { name: "person", limit: 60, windowSec: 60 } }, async ({ input }) => {
  const person = await getPersonPage(input.id);
  if (!person) throw notFound("We couldn’t find that person.");
  return person;
});
