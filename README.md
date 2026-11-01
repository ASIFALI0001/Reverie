# Reverie

Know you'll love it before you press play. Reverie is a discovery app for movies, series, anime and cartoons that learns your taste and gives every title a personal **Match %** with reasons. It also tells you where to watch legally in your region.

- **Your match, explained.** Every title page scores the title against your history (vector similarity + taste features + a Gemini judgement grounded in the six titles you've seen that are closest to it), with three reasons, a caveat and "because you liked…".
- **Title pages**: IMDb / Rotten Tomatoes / Metacritic / TMDB ratings, runtime, the story and its vibe, where to watch (stream / rent / buy), cast, trailers plus YouTube edits, reviews and explainers, the franchise timeline, and "More like this".
- **Ask**: natural-language search ("a movie like Jurassic World but scarier") returns ten ranked titles with reasons. The ⌘K / Ctrl K palette searches titles instantly.
- **Library and watchlist**: auto-organised by category, genre and franchise, with stats and a taste-over-time chart. The watchlist is ranked by your match.
- **Reviews in two taps**: after you watch something, Reverie asks what worked and what didn't (chips), with an optional line in your own words. That "why" feeds every later match.
- **Onboarding**: a two-minute taste game (formats, moods, a swipe deck, favourites) that ends in your Taste DNA and radar.
- **Home**: tonight's pick and rows tuned to you, with no LLM calls on the request path.
- **"Why not?"**: below 70%, the match says why a title might not be for you, with the titles from your own history it rests on, what you might still enjoy, and a "Was this right?".
- **Mood**: say how tonight feels (or pick a mood tile), how long you've got and who's watching; Reverie picks three, each swappable, optionally only from your own services.
- **"Should I keep going?"**: for a series you're partway through, a verdict from the episode ratings ahead of you, read against your taste, with every reason checked for spoilers.
- **Your taste over time**: eras found in your history and named, a radar that morphs between them, your numbers (hours, titles, most-watched genre, highest-rated title, favourite director, longest binge), share cards with your top three and a QR code, and a Wrapped story for any stretch of time.
- **Friends**: @handles, invite links and QR cards, requests, compare views, send-to-a-friend with a note, shared watchlists ranked by everyone's combined match, and an activity strip. You choose what friends see, per title too.
- **Taste Twins**: anonymous people whose taste is closest to yours; their ratings nudge your match, and you can connect when you both want to.
- **Admin**: a control room for the owner (users, taste, library, moderation with an audit log), behind a Firebase custom claim.
- **About** (`/about`): the whole story in sixteen animated chapters, with live miniatures of the real components.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router, Turbopack, Cache Components, `proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS 4, Motion, GSAP (ScrollTrigger, SplitText, loaded on demand), Lenis, Radix, cmdk, vaul |
| Data | MongoDB Atlas + Atlas Vector Search (Mongoose 9), TanStack Query, Zustand, Zod |
| Auth | Firebase Authentication (email/password + Google) → httpOnly session cookie verified by Firebase Admin |
| AI | Gemini via `@google/genai`: text and fast models with automatic fallbacks, `gemini-embedding-2` (768-d). When Gemini fails or stalls, Groq and then OpenRouter's free models answer instead. |
| Sources | TMDB, OMDb, YouTube Data API v3, Jikan (MyAnimeList) |

## Quick start

Requires Node 22+ and npm.

```bash
npm install
cp .env.example .env.local     # then fill it in (see "Keys" below)
npm run check:env              # makes one cheap call to each service; never prints secrets
npm run db:indexes             # collections, indexes, and the Atlas vector index
npm run seed -- --limit=200    # a quick smoke run of the catalog
npm run dev                    # http://localhost:3000
```

Run the full `npm run seed` when you're ready (see [Seeding](#seeding-the-catalog)). The app works before the seed finishes: any title someone opens is fetched and enriched on demand.

## Keys

Only `NEXT_PUBLIC_*` values reach the browser. Everything else stays on the server. The Firebase web config is public by design; access is controlled by authorized domains. Keep secrets in `.env.local`, which is git-ignored, and rotate any key that has been shared.

| Variable | Where to get it | Notes |
|---|---|---|
| `TMDB_READ_TOKEN`, `TMDB_API_KEY` | [themoviedb.org → Settings → API](https://www.themoviedb.org/settings/api) | The read token (v4 bearer) is used when present. Free; attribution is in the footer. |
| `OMDB_API_KEY` | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (activate from the email) | Optional. Free tier is 1,000 calls/day, so ratings are fetched when a title is opened and cached for 7 days. Without it, only the TMDB rating shows. |
| `YOUTUBE_API_KEY` | [Google Cloud console](https://console.cloud.google.com/apis/library/youtube.googleapis.com): enable **YouTube Data API v3**, then Credentials → Create API key (restrict it to that API) | Optional. Without it, "Watch the vibe" shows TMDB trailers only. One title costs about 101 of the 10,000 daily units; results are cached for 7 days. |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | The paid tier is much faster for seeding. Model variables are below. |
| `GROQ_API_KEY`, `GROQ_MODELS` | [console.groq.com/keys](https://console.groq.com/keys) | Optional first fallback when Gemini fails or stalls. Free tier: about 1,000 requests a day and 8,000 tokens a minute, per model. See [the fallback chain](#the-fallback-chain-gemini--groq--openrouter). |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODELS` | [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) | Optional second fallback, after Groq. The default list is free models. |
| `MONGODB_URI` | MongoDB Atlas (see [Atlas](#mongodb-atlas)) | Include the database name, e.g. `…mongodb.net/reverie?retryWrites=true&w=majority`. |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase console → Project settings → Service accounts → Generate new private key | Copy `project_id`, `client_email` and `private_key` from the JSON. Keep the quotes and the literal `\n` sequences in the key. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_APP_ID` | Firebase console → Project settings → General → Your apps → Web app | See [Firebase](#firebase) for the auth domain in production. |
| `NEXT_PUBLIC_SITE_URL` | Your URL | Used for canonical links, OG images, share links, and the invite links and QR codes on invite and share cards. |
| `DEFAULT_REGION` | ISO 3166-1 code | Where-to-watch region until a viewer picks their own in Settings. Default `IN`. |
| `SUPPORT_EMAIL` | An address you read | Optional. Shown on `/blocked` (the appeal link) and as the contact on the Terms, Privacy and Cookie pages. Set it before inviting people. |
| `TWIN_TOKEN_SECRET` | Any long random string (`openssl rand -base64 48`) | Optional. Signs the anonymous Taste Twin tokens; falls back to the Firebase admin key. Tokens are re-issued on every visit, so changing it only affects twin pages already open. |

### Gemini models

```bash
GEMINI_TEXT_MODEL=gemini-3.6-flash            # match judgements, re-ranking, search, Taste DNA
GEMINI_TEXT_FALLBACKS=gemini-3-flash-preview,gemini-3.5-flash-lite
GEMINI_FAST_MODEL=gemini-3.5-flash-lite       # bulk enrichment (vibe summaries while seeding)
GEMINI_FAST_FALLBACKS=gemini-flash-lite-latest,gemini-3-flash-preview
GEMINI_EMBED_MODEL=gemini-embedding-2
GEMINI_EMBED_DIM=768                          # must match numDimensions in the vector index
```

Every call walks its chain. A model that is overloaded (503), rate-limited (429, honouring the retry delay) or slow to start is skipped for a few minutes. A model that no longer exists (404) is skipped for a day. Free-tier capacity varies by model, which is why the chain exists. If a model is retired, change the variables. No code changes are needed.

### The fallback chain: Gemini → Groq → OpenRouter

With `GROQ_API_KEY` and/or `OPENROUTER_API_KEY` set, every structured AI call races Gemini against a fallback chain. The same prompt and JSON schema go down this list, in order, and the first answer that validates wins:

```bash
GROQ_MODELS=openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b
OPENROUTER_MODELS=nvidia/nemotron-3.5-super-vl:free,dots-studio/dots-3-note-preview:free,nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3-ultra-550b-a55b:free
```

- **When it starts.** Immediately if every Gemini model fails, or as a head start once Gemini has run past 30% of the call's time budget (between 4 and 8 s). Whichever side answers first wins, and the other request is cancelled. A Gemini model that loses the race rests for a minute, so the next calls go straight to the fast path. Models already known to be busy are skipped. Bulk jobs, like seeding, don't race; they fall back only when Gemini fails.
- **Speed (measured on Reverie's own prompts).** Groq answered in 0.5–1.6 s, with complete lists. The free OpenRouter models took 3–12 s.
- **Rate limits.** Each Groq model has its own per-minute token limit, so one that's rate-limited hands over to the next at once.
- **Reasoning.** It's switched off, or set to the lowest level. With reasoning on, the free models spent 12–41 s thinking and returned incomplete lists.
- **Retries.** An instant 5xx is retried once on the same model. A model that keeps failing, or a rejected key, is skipped for a while.
- **Last resort.** If the whole chain fails, the app falls back to its deterministic scores.
- **Embeddings never fall back.** Vectors from another model wouldn't match the index.
- **Privacy.** Fallback prompts carry titles, ratings, taste notes and the viewer's own review text, never names or emails. Free OpenRouter endpoints may log prompts.

`npm run check:env` reports which model answers on each provider.

## MongoDB Atlas

1. Create a cluster. M0 (free) works: it allows three search indexes and Reverie needs two. M0 also caps network transfer (about 10 GB a week each way); when that runs out Atlas throttles the link, and a cold Home build takes ~17 s instead of ~1 s. A paid tier removes the cap if you have real users.
2. Database Access → add a database user.
3. Network Access → add your IP for local work. For Vercel, allow `0.0.0.0/0` with a strong password, or use Vercel's static IPs.
4. Connect → Drivers → copy the connection string into `MONGODB_URI`, with a database name.
5. Run `npm run db:indexes`. It creates every collection, the regular and TTL indexes, and the vector index, then waits until the vector index is queryable.

To create the vector index by hand instead, open Atlas → Search & Vector Search → Create Search Index → **Atlas Vector Search** → JSON editor. Use the `titles` collection and name the index `titles_vec`:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine", "quantization": "none" },
    { "type": "filter", "path": "category" },
    { "type": "filter", "path": "mediaType" },
    { "type": "filter", "path": "genres" },
    { "type": "filter", "path": "year" },
    { "type": "filter", "path": "originalLanguage" },
    { "type": "filter", "path": "popularity" },
    { "type": "filter", "path": "voteCount" }
  ]
}
```

The second index finds Taste Twins. On the `tasteProfiles` collection, name it `taste_vec`:

```json
{
  "fields": [
    { "type": "vector", "path": "socialVector", "numDimensions": 768, "similarity": "cosine", "quantization": "none" },
    { "type": "filter", "path": "twinEligible" }
  ]
}
```

`socialVector` is the taste rebuilt without titles hidden from friends, so a hidden title never decides who's whose twin.

## Firebase

1. Create a project and add a **Web app**. Its config goes into the `NEXT_PUBLIC_FIREBASE_*` variables.
2. Authentication → Sign-in method → enable **Email/Password** and **Google** (set the support email).
3. Authentication → Settings → **Authorized domains**: `localhost` is there by default. Add your production domain, e.g. `reverie.vercel.app`.
4. Project settings → Service accounts → generate a key for the `FIREBASE_ADMIN_*` variables.
5. Google sign-in uses a popup, and a redirect on phones or when the popup is blocked. Redirects break on browsers that block third-party storage (Safari, Firefox) unless the auth handler is served from your own domain. In production:
   - set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to your app's domain (not `<project>.firebaseapp.com`). `next.config.ts` already proxies `/__/auth/*` and `/__/firebase/*` to `<project>.firebaseapp.com`;
   - in Google Cloud console → APIs & Services → Credentials, open the OAuth client "Web client (auto created by Google Service)" and add `https://<your-domain>/__/auth/handler` to its authorized redirect URIs.

   Locally, keep `<project>.firebaseapp.com`.

Sessions: the browser signs in with Firebase and posts the ID token to `/api/auth/session`, which sets an httpOnly, `Secure`, `SameSite=Lax` session cookie. API routes accept that cookie or `Authorization: Bearer <idToken>`. Mutations also check `Origin`. Password-reset emails use Firebase's templates (Authentication → Templates).

## Seeding the catalog

`npm run seed` builds the catalog the recommendations search over (the RAG corpus): about 4–5k titles from TMDB's popular and top-rated lists, plus anime, cartoons, and Indian and Korean titles. Each title is normalised and categorised, then gets its colours and blur placeholder, MyAnimeList data (anime), a Gemini vibe summary (fast model, batched) and an embedding.

```bash
npm run seed                      # everything; resumable, enriched titles are skipped
npm run seed -- --limit=200       # quick smoke run
npm run seed -- --omdb            # also fetch IMDb / RT / Metacritic (capped below the daily quota)
npm run seed -- --no-jikan --no-colors --chunk=40 --parallel=3 --refresh
npm run neighbors -- movie:68721  # sanity check: the nearest titles to Iron Man 3
```

On the free Gemini tier, embeddings are limited to roughly a thousand a day, so a full seed takes a few days of re-running (it resumes where it stopped). On the paid tier it takes minutes and costs a few dollars.

## How the match works

All the maths lives in pure, unit-tested functions in `lib/reco/`.

- **Taste profile.** Ratings, library states, swipes and favourites become weighted signals: 9–10 → +1, 7–8 → +0.6, 5–6 → +0.1, ≤4 → −0.7, favourite +1.2, dropped −0.5, and so on. Weights decay slowly with age. They produce a taste vector (positives minus half the negatives, blended with an embedding of your onboarding answers) and affinities for genres, keywords, people, vibe and era. The profile rebuilds in the background a moment after anything changes.
- **Reviews: the "why".** A rating says how much you liked something; your review says why. After you watch a title, the add/edit sheet (or, from the watchlist, a short follow-up) asks what worked and what didn't, as chips, plus an optional line in your own words. Those go to three places:
  - the match judgement, next to each of the six similar titles you've seen;
  - the taste summary and Taste DNA, which are rewritten whenever a review changes, with reviewed titles listed first;
  - the personal ranking in Ask.

  Two people who both rated Iron Man 3 9/10 get different advice once one says the banter carried it and the other says the villain was weak.
- **Match** = 0.35 × vector score + 0.25 × feature score + 0.40 × Gemini judgement, clamped to 1–99.
  - The vector score is the title's percentile against a sample of the catalog, so scores use the whole range.
  - The judgement sees your taste summary and the six seen titles closest to this one, with your ratings.
  - Lists use the quick estimate (0.58 × vector + 0.42 × features). Results are cached per profile version.
- **More like this.** Candidates come from TMDB recommendations, similar titles, the collection and the vector neighbours. They're scored on embedding, themes, vibe, lineage and genres, then Gemini re-ranks the top 30 with a "why".
- **Ask.** Gemini reads the request (reference titles, moods, constraints). Retrieval combines vector search, TMDB discover and the references' recommendations. Hard filters apply, then a fit ranking, then a personal judgement. The final order is 0.55 × fit + 0.45 × match, streamed as it's computed.
- **Evaluation.** `npm run eval:match` hides 20% of a viewer's ratings, rebuilds the profile from the rest and checks the predictions. Use `--uid=<firebase uid>` for a real viewer (20+ ratings) and `--llm=16` to include Gemini. On three synthetic viewers over five splits, the quick estimate reaches a Spearman ρ of 0.68 / 0.51 / 0.77, against 0.10 / 0.25 / 0.04 for ranking by TMDB rating. Reports are written to `.qa/eval/`.

### The v2 formulas

Each lives in a pure, unit-tested function, with the formula restated in its doc comment.

- **Taste match between two people** (`lib/social/similarity.ts`; friends, invites and twins). It's a weighted mean of the parts that exist, each in [−1, 1]:
  - 0.5 × the centred cosine of the taste vectors (the catalog mean is subtracted, since every embedding shares a large common direction);
  - 0.3 × the Pearson correlation of their ratings on shared titles (only with 5 or more);
  - 0.2 × the cosine of their genre affinities.

  The result c maps to a percentage as 40 + 60c (or 40 + 40c below zero), so 40% means "no relation". It only ever sees what friends may see.
- **Friend boost** (`lib/social/friend-boost.ts`). For each friend, s = max(0, (taste match − 40) / 60). Then:
  - f = Σ s·r/10 ÷ Σ s, over their visible ratings;
  - w = 0.1 × min(1, Σ s / 1.5);
  - final = (1 − w)·match + w·100f.
- **Twin nudge** (`lib/twins/math.ts`). Only when two or more twins rated the title:
  - t is the same similarity-weighted mean of their ratings;
  - final = 0.85·match + 0.15·100t.

  Friends and twins together never weigh more than 20%, and friends' share comes first. A twin needs a 65% taste match; you keep up to 10. Evaluated by `npm run eval:twins`, on a synthetic population of 72 people with 3 splits each: Spearman ρ goes from 0.623 to 0.666 with the nudge (better for 174 of 216 person-splits). Each run redraws the population, so compare the two rows of one run, not runs with each other.
- **Shared-list combined match** (`lib/social/combined-match.ts`): mean(m) − 0.6 × Σ max(0, 50 − mᵢ), clamped to 0–100. Anyone below 50% pulls a title down hard. Ties go to the title whose lowest member match is highest.
- **Mood fit** (`lib/mood/target.ts`): 0.6 × (1 − vibe distance) + 0.4 × (share of the wanted moods and themes present).
  - Plus 0.1 for a genre the mood leans to, minus 0.25 for something to avoid.
  - Runtime and format are hard filters.
  - The pick score is 0.5 × fit + 0.5 × match. The model picks the six best of the top 15, each with a line. Three are shown, at most one per franchise or collection, and the rest wait as swaps.
- **"Why not?"** (`lib/reco/why-not.ts`). Shown below a 70% match. The evidence is titles you disliked, dropped or rated low that sit closest to this one, plus feature mismatches: runtime against what you finish, pace/tone/depth distance, low-affinity genres, an era you rarely watch, and subtitles you'd rather avoid. The model may only use those facts; without it, the facts are the reasons.
- **"Should I keep going?"** (`lib/series/trend.ts`).
  - The average of the episodes ahead (5+ votes each) is compared with what you've watched: +0.3 or more → keep going, −0.3 or less → probably stop.
  - Otherwise, "give it till" the first 3-episode stretch that clearly beats what you've seen.
  - Reasons that name someone appearing only later, or use event words, are sent back once, then replaced by the numbers-only verdict.
- **Eras** (`lib/timeline/eras.ts`). The months of your history are split by optimal partitioning on their genre mixes: a squared distance to each era's mix, weighted by titles, plus a penalty of 0.9 per era, solved exactly by dynamic programming. The measured accuracy tables are in `.qa/notes.md`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run verify` | typecheck + lint + unit tests + production build |
| `npm test` | Vitest unit tests (taste maths, match blend, similarity, metrics, search helpers…) |
| `npm run e2e` | Playwright end-to-end suite (see below) |
| `npm run check:env` | Verify every configured service with a cheap real call |
| `npm run db:indexes` | Create collections, indexes and the vector index |
| `npm run seed` | Build or extend the catalog |
| `npm run neighbors -- <key>` | Nearest titles to one title, for checking embeddings |
| `npm run eval:match` | Offline evaluation of the match engine |
| `npm run migrate:v2` | Bring existing accounts up to v2: a provisional @handle, an invite code, privacy defaults, an active status. Idempotent. |
| `npm run backfill:snapshots` | Monthly taste snapshots for the taste timeline (only changed months are rebuilt; `-- --uid=<uid>` for one account) |
| `npm run backfill:twins` | Recompute everyone's Taste Twins. Twins already refresh after each profile change; run this nightly as the catch-up. |
| `npm run eval:twins` | Offline evaluation of the twin nudge on a synthetic population |
| `npm run make-admin -- <email>` | Grant the admin claim (`--revoke` to remove it). The person then signs in again at `/admin/login`. |
| `npm run shots -- / title/movie/68721-iron-man-3 --full` | Design QA screenshots at 1440 and 390 px (`--reduced`, `--light`, `--click=<css>`) into `.qa/shots/` |

## Upgrading an existing install to v2

Run these once, in order, after pulling v2:

```bash
npm run db:indexes            # new collections and indexes, TTLs (activity 90 days, notifications 180), and taste_vec
npm run migrate:v2            # handles, invite codes, privacy defaults, account status
npm run backfill:snapshots    # taste timeline history
npm run backfill:twins        # first Taste Twins for everyone
npm run make-admin -- you@example.com
```

Then sign in at `/admin/login`. Admin access is a Firebase custom claim checked on every admin request, together with session revocation. Blocking or unblocking someone also needs a sign-in within the last 30 minutes. Every admin read of someone's account and every moderation step is written to the audit log (`/admin/audit`). The privacy page says that admins can see account data.

Schedule `npm run backfill:twins` nightly, from any machine with the `.env.local` values (cron, Task Scheduler, or a scheduled CI job). Without it, twins still refresh whenever a profile changes, but people who stop using the app are only re-scored when others change.

## Testing

- `npm run e2e` starts `npm run dev` if nothing is on port 3000. To test a production build, run `npm run build && npx next start -p 3100`, then `E2E_BASE=http://localhost:3100 npm run e2e`.
- The suite uses the real services. It creates throwaway Firebase users (`qa+…@reverie.test`) through the Admin SDK and deletes them, with their data, afterwards. Email/Password sign-in must be enabled, and the run uses some TMDB and Gemini quota.
- `e2e/a11y.spec.ts` runs axe (WCAG 2.1 A/AA) on signed-out and signed-in pages and fails on serious or critical issues. The v2 specs run axe on their own pages too.
- The friends, twins and admin specs use two to six throwaway accounts at once, to check what each person can and can't see (hidden titles never leak, blocked users get 403 everywhere, non-admins get 403 on every admin route).
- `e2e/about.spec.ts` walks all sixteen chapters at 1440 and 390 px, with motion and with reduced motion, and saves screenshots to `.qa/shots/<QA_LABEL>/`.

## Deploying to Vercel

1. Import the repository (framework: Next.js; Node 22).
2. Add every variable from `.env.example` for Production (and Preview if you use it):
   - `NEXT_PUBLIC_SITE_URL` = your production URL;
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = your app's domain (see [Firebase](#firebase), step 5);
   - paste `FIREBASE_ADMIN_PRIVATE_KEY` with its `\n` sequences; both forms are accepted.
3. Allow Vercel in Atlas Network Access, and add the Vercel domain to Firebase's authorized domains.
4. Put the functions in a region close to your Atlas cluster (Project → Settings → Functions).
5. Deploy. Background work (profile rebuilds, cache warming) runs through `after()`, which Vercel supports.

## Data sources and legal

- Metadata and images come from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.
- Where-to-watch data is provided by JustWatch through TMDB, with attribution under the providers.
- IMDb, Rotten Tomatoes and Metacritic ratings come from OMDb. Anime details come from MyAnimeList through Jikan.
- Videos come from the YouTube Data API and play in privacy-enhanced (`youtube-nocookie.com`) embeds.
- Reverie only links to licensed services. There are no downloads, torrents or unlicensed streams. When a title isn't available in your region, the page says "Not streaming in your region right now" and offers the watchlist.
- **Terms of Service** (`/terms`), **Privacy Policy** (`/privacy`) and **Cookie Policy** (`/cookies`) describe what the code actually does. They're linked from every footer and from sign-up.
  - The terms name India as governing law and set a minimum age of 13. Change these if they don't fit.
  - Have them reviewed before a public launch: they're written carefully, but they aren't legal advice.
- **Cookie notice.** It shows once to each new browser. Reverie sets only essential cookies (`rv_session`, `rv_hint`) and keeps a few settings in browser storage, with no analytics or ads, so the notice informs rather than asks.
- **If you change what the app stores:**
  1. Update the tables in `app/(site)/cookies/page.tsx`.
  2. Bump `COOKIE_NOTICE_VERSION` and `LEGAL_UPDATED` in `lib/legal.ts`, so the notice shows again.
  3. If you ever add analytics or other optional cookies, give the notice real Accept / Reject choices first.

## Project layout

```
app/            routes: (site) pages, (auth) pages, admin, onboarding, api/*, og images, error and 404 states
components/     ui primitives, layout (nav, dock), title, library, onboarding, search, home, landing,
                mood, series, taste, social, twins, admin, about (chrome + one scene per chapter), motion, fx
lib/
  reco/         taste profile, match, why-not, similar, ask and home pipelines (pure maths unit-tested)
  social/       visibility (the one privacy gate), friendships, taste match, boosts, shared lists, activity
  twins/        twin maths and recompute        mood/  mood targets and picks
  series/       episode trends and verdicts      timeline/  snapshots, eras, Wrapped
  admin/        guard, audit log, moderation     about/  the About story's data
  ai/           Gemini client with model chains, prompts and schemas
  catalog/      normalisation, categories, shelves, on-demand enrichment (ensureTitle)
  sources/      TMDB, OMDb, YouTube, Jikan clients (typed, cached in Mongo)
  db/           connection and models
scripts/        seed, db-indexes, migrate-v2, backfills, make-admin, eval-match, eval-twins, check-env, neighbors, shots
tests/          Vitest     e2e/   Playwright     .qa/   screenshots, Lighthouse reports, eval reports, design notes
```

## Known limitations

- Custom shelves can be created and assigned from the add/edit sheet, but you can't drag cards onto them yet.
- Without a YouTube key, "Watch the vibe" shows TMDB trailers only.
- On the free Gemini tier, a first-time match, "More like this" list or search can take several seconds. Results are cached, and the fallbacks keep answers coming when a model is busy.
- Lighthouse (mobile, simulated throttling, local production build): performance is 90 for the landing page, 89–90 for search, 89 for a person page, 84–85 for a title page (median 85) and 84–85 for the About story, with accessibility at 100 on all of them.
- Notifications are polled every minute while the tab is visible, not pushed.
- Taste Twins need people: with only a handful of accounts, most people won't have twins yet. A title page's largest paint is the backdrop from TMDB's image CDN, which shares the simulated connection with the framework's JavaScript. A deployed build behind a CDN will measure differently.
