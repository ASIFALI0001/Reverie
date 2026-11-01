import type { NextRequest } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/route";
import { getWatchProviders, type ProviderEntry } from "@/lib/sources/tmdb";
import { TitleParams } from "@/lib/api/title-params";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { env } from "@/lib/env";
import type { Provider, ProviderGroups } from "@/lib/catalog/providers";

const Input = TitleParams.extend({ region: z.string().regex(/^[A-Za-z]{2}$/).optional() });

const tidy = (list: ProviderEntry[] | undefined): Provider[] =>
  [...(list ?? [])]
    .sort((a, b) => a.display_priority - b.display_priority)
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));

function geoRegion(req: NextRequest) {
  const geo = req.headers.get("x-vercel-ip-country");
  return geo && /^[A-Z]{2}$/.test(geo) ? geo : null;
}

/** Official places to stream, rent or buy in one region (TMDB × JustWatch). */
export const GET = route(
  { auth: "optional", input: Input, rateLimit: { name: "providers", limit: 120, windowSec: 60 } },
  async ({ req, input, user }) => {
    let region = input.region?.toUpperCase();
    if (!region && user) {
      await connectDb();
      region = (await User.findById(user.uid, { region: 1 }).lean())?.region ?? undefined;
    }
    region ??= geoRegion(req) ?? env.defaultRegion();

    const all = await getWatchProviders(input.mediaType, input.id);
    const r = all.results?.[region] ?? {};
    const freeIds = new Set<number>();
    const free = [...tidy(r.free), ...tidy(r.ads)].filter((p) => !freeIds.has(p.id) && freeIds.add(p.id));
    const groups: ProviderGroups = {
      region,
      link: r.link ?? null,
      stream: tidy(r.flatrate),
      free,
      rent: tidy(r.rent),
      buy: tidy(r.buy),
    };
    return groups;
  },
);
