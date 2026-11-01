import { SplitHeading } from "@/components/motion/SplitHeading";
import type { TitleReview } from "@/lib/catalog/types";

export function ReviewsSection({ reviews }: { reviews: TitleReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="page border-t border-hairline py-[var(--section-y)]">
      <SplitHeading className="text-h2">What people said</SplitHeading>
      <div className="mt-12 grid gap-x-[var(--gutter)] gap-y-12 md:grid-cols-3">
        {reviews.map((r) => (
          <figure key={r.url} className="flex flex-col">
            <blockquote className="font-display text-[1.375rem] italic leading-[1.3]">“{r.excerpt}”</blockquote>
            <figcaption className="mt-5 text-meta text-muted">
              <span className="text-text">{r.author}</span>
              {r.rating != null ? <span className="numeral"> · {r.rating}/10</span> : null}
              {" · "}
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="link-draw text-text/80">
                Read the full review
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
