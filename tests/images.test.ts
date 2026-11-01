import { describe, expect, it } from "vitest";
import loader from "@/lib/images/loader";
import { tmdbImg } from "@/lib/images/tmdb";

describe("image loader → nearest TMDB size", () => {
  it("rounds poster widths up to the next TMDB size", () => {
    expect(loader({ src: "/tmdb/poster/a.jpg", width: 300 })).toBe("https://image.tmdb.org/t/p/w342/a.jpg");
    expect(loader({ src: "/tmdb/poster/a.jpg", width: 92 })).toBe("https://image.tmdb.org/t/p/w92/a.jpg");
  });
  it("uses original for very wide posters and backdrops", () => {
    expect(loader({ src: "/tmdb/poster/a.jpg", width: 1920 })).toBe("https://image.tmdb.org/t/p/original/a.jpg");
    expect(loader({ src: "/tmdb/backdrop/b.jpg", width: 3840 })).toBe("https://image.tmdb.org/t/p/original/b.jpg");
  });
  it("caps thumbnails, profiles and logos instead of escalating to original", () => {
    expect(loader({ src: "/tmdb/thumb/a.jpg", width: 3840 })).toBe("https://image.tmdb.org/t/p/w185/a.jpg");
    expect(loader({ src: "/tmdb/profile/p.jpg", width: 3840 })).toBe("https://image.tmdb.org/t/p/w185/p.jpg");
  });
  it("passes local assets through", () => {
    expect(loader({ src: "/demo/metropolis.jpg", width: 640 })).toBe("/demo/metropolis.jpg?w=640");
  });
  it("builds loader paths from TMDB file paths", () => {
    expect(tmdbImg("/abc.jpg", "backdrop")).toBe("/tmdb/backdrop/abc.jpg");
    expect(tmdbImg(null)).toBeNull();
  });
});
