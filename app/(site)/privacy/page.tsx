import type { Metadata } from "next";
import { LegalLink, LegalPage, LegalSection, SupportLine } from "@/components/legal/LegalPage";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Reverie collects, why, who can see it, how long it's kept and the choices you have.",
  alternates: { canonical: "/privacy" },
};

/** The privacy policy, in plain words. Static; the support address comes from SUPPORT_EMAIL. */
export default function PrivacyPage() {
  const support = env.supportEmail();
  return (
    <LegalPage current="/privacy" title="Privacy Policy" lede="What Reverie collects, why, who can see it, and what you can change.">
      <LegalSection id="who" title="Who we are">
        <p>
          Reverie is an independent service for discovering films, series, anime and cartoons, made and run by Asif (“Reverie”, “we”,
          “us”). This policy explains what we collect when you use Reverie, why we collect it, who can see it and the choices you have.
          It works together with our <LegalLink href="/terms">Terms of Service</LegalLink> and{" "}
          <LegalLink href="/cookies">Cookie Policy</LegalLink>.
        </p>
        <p>
          <strong>The short version:</strong> we use what you tell Reverie about your taste to recommend things to you, and for nothing
          else. We don’t sell your data, we don’t show ads, and we don’t use tracking or advertising cookies.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="What we collect">
        <p>
          <strong>Your account.</strong> Your email address and name, and your profile photo if you sign in with Google. Passwords are
          handled by Google Firebase Authentication; we never see or store them.
        </p>
        <p>
          <strong>Your profile and settings.</strong> Your @handle, avatar, region, languages, the streaming services you have, your
          privacy settings and your invite code.
        </p>
        <p>
          <strong>Your taste.</strong> Your library and watchlist (with statuses, ratings and where you are in a series), what worked and
          what didn’t, the reviews and notes you write, your onboarding answers, your answers to “Was this right?” and “Should I keep
          going?”, your mood searches and your recent searches. From these, Reverie builds your taste profile, Taste DNA and taste
          timeline.
        </p>
        <p>
          <strong>Friends.</strong> Friend requests and friendships, people you’ve blocked, titles you send or receive (with any note),
          shared lists, recent activity, notifications and Taste Twin connections.
        </p>
        <p>
          <strong>Technical information.</strong> Like any website, our servers and hosting provider process technical details of your
          requests, such as your IP address, browser type and the time of each request, to deliver pages, keep Reverie secure and
          prevent abuse. Rate limits use your account or, when you’re signed out, your IP address, and expire within an hour.
        </p>
      </LegalSection>

      <LegalSection id="use" title="How we use it">
        <ul>
          <li>To run Reverie: your match scores and their reasons, recommendations, search, mood picks, series verdicts, your library and your taste timeline.</li>
          <li>To show friends what your privacy settings allow, and, if you take part, to find your Taste Twins.</li>
          <li>To keep accounts secure, prevent abuse and enforce our Terms of Service.</li>
          <li>To answer you when you contact us, and to improve how well Reverie recommends.</li>
        </ul>
        <p>
          If you’re in the European Economic Area or the United Kingdom, we rely on these legal bases: providing the service you signed
          up for (contract), keeping Reverie safe and working well (legitimate interests), and your consent where we ask for it, which you
          can withdraw at any time.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="AI and your data">
        <p>
          Match explanations, search, summaries, your Taste DNA and some recommendations are written by AI models: Google Gemini and,
          when Gemini is unavailable, Groq or OpenRouter. What we send them is about titles and taste (titles, ratings, taste notes and
          the reviews you write), never your name or email address. Some free models available through OpenRouter may keep prompts.
        </p>
        <p>
          AI can be wrong. Treat match scores and explanations as informed estimates, not facts about you or the title.
        </p>
      </LegalSection>

      <LegalSection id="visibility" title="Who can see your information">
        <p>
          <strong>You</strong> see everything. <strong>Friends</strong> see what your privacy setting allows (Everything, Ratings only or
          Nothing; Ratings only by default), and never anything you’ve hidden from friends.
        </p>
        <p>
          <strong>Other members</strong> who open your profile see your name, @handle, avatar, Taste DNA and how close your taste is to
          theirs. If you’re findable in search (you can turn this off), they can find you by name or @handle.{" "}
          <strong>Anyone with your invite link</strong> sees your name, avatar and Taste DNA, so they know who’s inviting them. Taste DNA
          shown to others never mentions a title you’ve hidden from friends.
        </p>
        <p>
          <strong>Taste Twins</strong> see a codename, an abstract avatar, how close your tastes are, the genres you share and titles you
          both loved, never your name, until you both choose to connect. You can leave Taste Twins in Settings.
        </p>
        <p>
          <strong>Share cards</strong> you create show your name, Taste DNA and radar, your top-rated titles (never ones you’ve hidden from
          friends), your eras, a few numbers and a code linking to your invite. They’re seen only by the people you share them with.
        </p>
        <p>
          <strong>Administrators</strong> can open any account, including items hidden from friends, notes and reviews, to moderate
          Reverie and to help when you ask for support. Hiding something from friends doesn’t hide it from administrators. Every time an
          administrator opens an account or takes an action, it’s recorded in an audit log.
        </p>
      </LegalSection>

      <LegalSection id="providers" title="Who we work with">
        <p>We use a small number of providers to run Reverie. They process data on our behalf, under their own terms and safeguards:</p>
        <ul>
          <li>
            <strong>Google Firebase</strong> for sign-in.
          </li>
          <li>
            <strong>MongoDB Atlas</strong> to store your data.
          </li>
          <li>
            <strong>Our hosting provider</strong> to serve the app.
          </li>
          <li>
            <strong>Google Gemini, Groq and OpenRouter</strong> for the AI features described above.
          </li>
        </ul>
        <p>
          Title information comes from TMDB, OMDb, YouTube, JustWatch (through TMDB) and MyAnimeList (through Jikan). Our servers ask them
          about titles (including the words you search for), never about who you are. Your browser loads posters and images directly from TMDB and video thumbnails from YouTube, and
          trailers play in YouTube’s privacy-enhanced player, so those services receive your IP address and browser details as with any
          content on the web.
        </p>
        <p>
          Reverie uses YouTube API Services. When you watch videos on Reverie, the{" "}
          <LegalLink href="https://www.youtube.com/t/terms">YouTube Terms of Service</LegalLink> and the{" "}
          <LegalLink href="https://policies.google.com/privacy">Google Privacy Policy</LegalLink> apply too.
        </p>
        <p>We don’t sell, rent or trade your personal information, and we don’t share it for advertising.</p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          Reverie uses two essential cookies to keep you signed in, and your browser’s storage to remember settings such as your theme.
          There are no advertising, analytics or tracking cookies. The <LegalLink href="/cookies">Cookie Policy</LegalLink> lists each one.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <ul>
          <li>Your account, library, ratings, reviews and lists: until you delete them or your account.</li>
          <li>Recent searches and friend activity: 90 days.</li>
          <li>Notifications: 180 days.</li>
          <li>Saved match explanations: 30 days.</li>
          <li>Rate-limit records: under an hour.</li>
        </ul>
        <p>
          Deleting your account removes your data from Reverie for good: your profile, library, ratings and reviews, friendships,
          recommendations, Taste Twin connections and lists only you were in. Lists you shared stay with their other members. The
          administrators’ audit log keeps its record that your account existed and what was done with it, so access stays traceable.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="Your choices and rights">
        <p>
          In <LegalLink href="/settings">Settings</LegalLink> you can change who sees what, hide any title from friends, leave Taste Twins,
          stop appearing in search, reset your taste profile and delete your account. You can edit or delete any rating, review or list
          wherever it appears.
        </p>
        <p>
          Depending on where you live, you may also have the right to ask for a copy of your data, to correct or delete it, to object to
          or restrict how we use it, to take it elsewhere, and to complain to your data protection authority. To ask, contact us below; we
          answer within 30 days.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          Reverie isn’t meant for children under 13, and they may not create an account. If you believe a child under 13 has given us
          personal information, contact us and we’ll delete it.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="International transfers">
        <p>
          Our providers may store and process data in countries other than yours, including the United States. Where that happens, we rely
          on the safeguards those providers offer for international transfers.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Sessions use secure, http-only cookies checked on our servers, privacy rules are enforced on the server for every request, and
          administrator access is limited and logged. No service can promise perfect security, so please use a strong password that you
          don’t use anywhere else.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          When this policy changes, we’ll update the date at the top. If a change matters, for example a new kind of data or a new use for
          it, we’ll tell you in the app before it takes effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>Questions, a request about your data, or something to correct? Reverie is made and run by Asif.</p>
        <SupportLine email={support} />
      </LegalSection>
    </LegalPage>
  );
}
