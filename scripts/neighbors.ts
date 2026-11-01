/**
 * Sanity check for the embeddings: the nearest titles to a given one.
 *   npm run neighbors -- movie:68721
 *   npm run neighbors -- tv:13916 --same-category
 */
import "./_env";
import mongoose from "mongoose";
import { embeddingOf, vectorSearch } from "@/lib/reco/vector-search";
import { titlesCol } from "@/lib/db/titles";
import { parseTitleKey, type TitleKey } from "@/lib/catalog/types";

async function main() {
  const key = (process.argv.find((a) => parseTitleKey(a)) ?? "movie:68721") as TitleKey;
  const col = await titlesCol();
  const source = await col.findOne({ _id: key }, { projection: { title: 1, year: 1, category: 1, vibe: 1 } });
  if (!source) throw new Error(`${key} isn't in the catalog yet — run the seed first.`);
  const vec = await embeddingOf(key);
  if (!vec) throw new Error(`${key} has no embedding yet.`);

  const sameCategory = process.argv.includes("--same-category");
  const hits = await vectorSearch(vec, { limit: 10, exclude: [key], filter: sameCategory ? { category: source.category } : undefined });
  const docs = new Map((await col.find({ _id: { $in: hits.map((h) => h.key) } }, { projection: { title: 1, year: 1, category: 1 } }).toArray()).map((d) => [d._id, d]));

  console.log(`\n${source.title} (${source.year}) · ${source.category}`);
  if (source.vibe) console.log(`“${source.vibe.summary}”\n`);
  for (const h of hits) {
    const d = docs.get(h.key);
    console.log(`  ${h.score.toFixed(3)}  ${d?.title} (${d?.year}) · ${d?.category}`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
