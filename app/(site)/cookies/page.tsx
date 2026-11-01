import type { Metadata } from "next";
import { LegalLink, LegalPage, LegalSection, SupportLine } from "@/components/legal/LegalPage";
import { env } from "@/lib/env";
import { COOKIE_NOTICE_KEY } from "@/lib/legal";
import { MUSIC_PREF_KEY } from "@/lib/music";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Every cookie and piece of browser storage Reverie uses, what it's for and how long it lasts. No ads, no tracking.",
  alternates: { canonical: "/cookies" },
};

type Row = { name: string; where?: string; what: string; kind: "Essential" | "Functional" | "Preference"; lasts: string };

// Kept in step with the code: lib/auth/constants.ts, lib/theme.ts, lib/social/pending-invite.ts,
// components/auth/GoogleButton.tsx, components/library/LibraryView.tsx, lib/store/onboarding.ts, lib/legal.ts,
// lib/music.ts.
const COOKIES: Row[] = [
  {
    name: "rv_session",
    what: "Keeps you signed in. Secure and http-only: scripts on the page can’t read it, and our servers check it on every request.",
    kind: "Essential",
    lasts: "14 days, or until you sign out",
  },
  {
    name: "rv_hint",
    what: "Tells the app that a session exists, so pages open in the right state. It holds only the time you signed in.",
    kind: "Essential",
    lasts: "14 days, or until you sign out",
  },
];

const STORAGE: Row[] = [
  { name: "firebaseLocalStorageDb", where: "IndexedDB", what: "Firebase Authentication keeps your sign-in working between visits.", kind: "Essential", lasts: "Until you sign out" },
  { name: "rv:auth-next", where: "Session storage", what: "Remembers which page to return to after you sign in with Google.", kind: "Essential", lasts: "Until you close the tab" },
  { name: "reverie-onboarding", where: "Session storage", what: "Keeps your onboarding answers if you reload half-way through.", kind: "Essential", lasts: "Until you close the tab" },
  { name: "rv:pending-invite", where: "Local storage", what: "Holds a friend’s invite you opened, so it still works after you sign up.", kind: "Functional", lasts: "Until used, at most 7 days" },
  { name: "reverie-theme", where: "Local storage", what: "Your light or dark theme.", kind: "Preference", lasts: "Until you change it" },
  { name: "reverie-library-view", where: "Local storage", what: "Grid or list view in your library.", kind: "Preference", lasts: "Until you change it" },
  { name: MUSIC_PREF_KEY, where: "Local storage", what: "Whether you turned off the background music on the home and About pages.", kind: "Preference", lasts: "Until you change it" },
  { name: COOKIE_NOTICE_KEY, where: "Local storage", what: "Remembers that you’ve seen the cookie notice.", kind: "Preference", lasts: "Until you clear it" },
];

function Table({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-meta">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-hairline-strong text-muted">
          <th scope="col" className="w-[36%] py-2.5 pr-4 font-normal">
            Name
          </th>
          <th scope="col" className="py-2.5 pr-4 font-normal">
            What it’s for
          </th>
          <th scope="col" className="w-[24%] py-2.5 font-normal">
            How long
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-hairline align-top">
            <td className="py-3.5 pr-4">
              <code className="break-all font-mono text-[0.75rem] text-text">{r.name}</code>
              {r.where ? <span className="mt-1 block text-muted">{r.where}</span> : null}
            </td>
            <td className="py-3.5 pr-4 text-text/90">
              <span className="mb-1 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted">{r.kind}</span>
              {r.what}
            </td>
            <td className="py-3.5 text-muted">{r.lasts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The cookie policy: every cookie and storage key the app sets, as the code sets them. */
export default function CookiesPage() {
  const support = env.supportEmail();
  return (
    <LegalPage current="/cookies" title="Cookie Policy" lede="Two cookies to keep you signed in, a few settings remembered in your browser. No ads, no tracking.">
      <LegalSection id="what" title="What cookies are">
        <p>
          Cookies are small files a website stores in your browser. Sites also use similar storage built into browsers, such as local
          storage, session storage and IndexedDB. This policy covers all of them, and works together with our{" "}
          <LegalLink href="/privacy">Privacy Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies we set">
        <p>Only these two, both needed to keep you signed in. Neither is used for tracking or advertising.</p>
        <Table caption="Cookies Reverie sets" rows={COOKIES} />
      </LegalSection>

      <LegalSection id="storage" title="What we keep in your browser">
        <p>This storage stays on your device. Unlike cookies, it isn’t attached to your requests automatically, and none of it is used for tracking.</p>
        <Table caption="Browser storage Reverie uses" rows={STORAGE} />
      </LegalSection>

      <LegalSection id="third-parties" title="Other services">
        <p>
          <strong>Google sign-in.</strong> If you choose to continue with Google, Google’s sign-in window uses Google’s own cookies, under
          the <LegalLink href="https://policies.google.com/privacy">Google Privacy Policy</LegalLink>.
        </p>
        <p>
          <strong>YouTube.</strong> Trailers and videos play in YouTube’s privacy-enhanced player and load only when you press play. YouTube
          may then store cookies or similar data in your browser, under the{" "}
          <LegalLink href="https://policies.google.com/privacy">Google Privacy Policy</LegalLink>.
        </p>
        <p>
          <strong>Images.</strong> Posters come from TMDB and video thumbnails from YouTube, loaded directly by your browser. Reverie sets
          no cookies through them, though like any image on the web they see your IP address.
        </p>
      </LegalSection>

      <LegalSection id="none" title="What we don’t use">
        <p>
          No advertising cookies, no analytics, no tracking pixels and no cross-site tracking. We don’t sell or share data for advertising.
        </p>
        <p>
          Everything listed above is either needed for Reverie to work or remembers a choice you made, so we show a notice rather than ask
          for consent. If we ever add optional cookies, such as analytics, we’ll ask first, and you’ll be able to say no.
        </p>
      </LegalSection>

      <LegalSection id="manage" title="Managing cookies">
        <p>
          You can see and delete cookies and site data in your browser’s settings, and block them for Reverie entirely. If you block or
          delete the essential cookies, you’ll be signed out and won’t be able to sign in again until you allow them. Clearing site data
          also resets your theme and the other settings above.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and contact">
        <p>
          When this policy changes, we’ll update the date at the top, and if it matters, the cookie notice will show again. Questions? Reverie
          is made and run by Asif.
        </p>
        <SupportLine email={support} />
      </LegalSection>
    </LegalPage>
  );
}
