import type { Metadata } from "next";
import { LegalLink, LegalPage, LegalSection, SupportLine } from "@/components/legal/LegalPage";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Reverie: your account, your content, fair use, and what Reverie can and can't promise.",
  alternates: { canonical: "/terms" },
};

/** The terms of service, in plain words. Static; the support address comes from SUPPORT_EMAIL. */
export default function TermsPage() {
  const support = env.supportEmail();
  return (
    <LegalPage current="/terms" title="Terms of Service" lede="The agreement between you and Reverie, in plain words.">
      <LegalSection id="agreement" title="1. The agreement">
        <p>
          These terms are an agreement between you and Reverie, an independent service made and run by Asif (“Reverie”, “we”, “us”). By
          creating an account or using Reverie, you agree to them. Our <LegalLink href="/privacy">Privacy Policy</LegalLink> and{" "}
          <LegalLink href="/cookies">Cookie Policy</LegalLink> explain how we handle your information.
        </p>
        <p>If you don’t agree with these terms, please don’t use Reverie.</p>
      </LegalSection>

      <LegalSection id="account" title="2. Your account">
        <ul>
          <li>You need to be at least 13 years old, and old enough under the law where you live to agree to these terms yourself.</li>
          <li>Give accurate information, keep your password to yourself, and tell us if you think someone else has used your account.</li>
          <li>One account per person. Your @handle can’t impersonate someone else or mislead people about who you are.</li>
          <li>You’re responsible for what happens on your account.</li>
        </ul>
      </LegalSection>

      <LegalSection id="service" title="3. What Reverie is">
        <p>
          Reverie helps you decide what to watch. It learns your taste from what you tell it and gives each title a personal match score
          with reasons, recommendations, search, mood picks, series verdicts and ways to share with friends.
        </p>
        <p>
          <strong>Scores and explanations are estimates, not promises.</strong> Many are written by AI models, which can be wrong,
          incomplete or out of date. Spoiler protection is careful but not infallible. Use your own judgement, and don’t rely on Reverie for
          anything important.
        </p>
        <p>Reverie is free. We may add, change or remove features over time.</p>
      </LegalSection>

      <LegalSection id="watching" title="4. Where to watch">
        <p>
          Reverie doesn’t host, stream, sell or download any film or episode. “Where to watch” links go to official third-party services,
          using availability data from JustWatch through TMDB, which can be incomplete or out of date. Those services have their own terms,
          prices and privacy policies, and we’re not responsible for them.
        </p>
        <p>
          Trailers and videos play from YouTube. By watching them on Reverie you also agree to the{" "}
          <LegalLink href="https://www.youtube.com/t/terms">YouTube Terms of Service</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection id="content" title="5. Your content">
        <p>
          Ratings, reviews, notes, lists, the notes you send with recommendations, and your profile are your content. You keep ownership of
          it.
        </p>
        <p>
          You give Reverie permission to store, process and display your content in order to run the service: for example, to show it to
          you, to show it to friends as your privacy settings allow, and to use it (including through our AI providers) to make your
          recommendations. This permission ends when you delete the content or your account, except for copies others already received,
          such as a recommendation you sent.
        </p>
        <p>
          Only post what you have the right to share. Don’t post anything unlawful, hateful, harassing, sexually explicit or that reveals
          someone else’s private information. We may remove content that breaks these terms.
        </p>
      </LegalSection>

      <LegalSection id="use" title="6. Fair use">
        <p>Please don’t:</p>
        <ul>
          <li>harass, threaten or spam other people, or use Reverie to send them unwanted content;</li>
          <li>try to see information that isn’t yours, or get around privacy settings, blocks, rate limits or security;</li>
          <li>scrape Reverie, access it with bots, or overload it beyond normal personal use;</li>
          <li>copy, resell or build a competing service from Reverie’s data or design;</li>
          <li>use Reverie to find or share pirated copies of films or shows;</li>
          <li>break the law, or help anyone else do any of this.</li>
        </ul>
      </LegalSection>

      <LegalSection id="friends" title="7. Friends and Taste Twins">
        <p>
          Friends see what your privacy setting allows. Taste Twins are introduced anonymously and only learn who you are if you both choose
          to connect. You can remove a friend, block anyone, leave Taste Twins and hide any title from friends at any time. Be kind: other
          people’s tastes are as personal as yours.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="8. Reverie and third-party content">
        <p>
          Reverie’s design, code, brand and the text we write belong to us. Film and series information, posters and images belong to their
          owners and come to Reverie from TMDB, OMDb, YouTube, JustWatch and MyAnimeList (through Jikan). This product uses the TMDB API but
          is not endorsed or certified by TMDB. Names and trademarks of streaming services belong to their owners.
        </p>
        <p>We give you a personal, non-transferable permission to use Reverie for your own non-commercial use, under these terms.</p>
      </LegalSection>

      <LegalSection id="suspension" title="9. Suspension and ending">
        <p>
          If you break these terms, or we need to protect other people or Reverie, we may remove content or block your account, for a
          while or for good. Where we can, we’ll tell you why and how long the block lasts, and you can ask us to look at it again.
        </p>
        <p>
          You can stop using Reverie and delete your account at any time in <LegalLink href="/settings">Settings</LegalLink>. We may stop
          offering Reverie; if we do, we’ll try to give you reasonable notice.
        </p>
      </LegalSection>

      <LegalSection id="warranty" title="10. No guarantees">
        <p>
          Reverie is provided “as is” and “as available”. We work hard to keep it accurate and running, but we can’t promise it will always
          be available, error-free or right about what you’ll enjoy. Nothing in these terms takes away rights you have under consumer law
          that can’t be excluded.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="11. Liability">
        <p>
          To the extent the law allows, Reverie isn’t liable for indirect or consequential losses, for lost data, or for problems caused by
          third-party services such as streaming providers. Because Reverie is free, our total liability to you for any claim is limited to
          the amount you’ve paid us in the 12 months before it, if any. Nothing here limits liability that can’t be limited by law.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to these terms">
        <p>
          We may update these terms as Reverie changes. We’ll update the date at the top, and if a change matters, we’ll tell you in the app
          before it takes effect. If you keep using Reverie after that, the new terms apply.
        </p>
      </LegalSection>

      <LegalSection id="law" title="13. Governing law">
        <p>
          These terms are governed by the laws of India, and the courts of India have jurisdiction over disputes about them. If you live
          elsewhere, you keep any protections your local consumer law gives you. If any part of these terms turns out to be unenforceable,
          the rest still applies.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact">
        <p>Questions about these terms, or want to report a problem or appeal a decision? Reverie is made and run by Asif.</p>
        <SupportLine email={support} />
      </LegalSection>
    </LegalPage>
  );
}
