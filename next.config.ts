import type { NextConfig } from "next";

const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // TMDB serves fixed sizes; lib/images/loader.ts maps widths to them (no optimizer quota).
    loader: "custom",
    loaderFile: "./lib/images/loader.ts",
    // Small srcset candidates at TMDB's own poster widths, so a 300px slot asks for w342, not w500.
    imageSizes: [16, 32, 48, 64, 92, 154, 185, 342, 500],
  },
  async rewrites() {
    // Firebase's recommended setup for signInWithRedirect on browsers that block
    // third-party storage: serve the auth helper from our own domain
    // (set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN to the app's domain in production).
    if (!firebaseProject) return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${firebaseProject}.firebaseapp.com/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${firebaseProject}.firebaseapp.com/__/firebase/:path*` },
    ];
  },
};

export default nextConfig;
