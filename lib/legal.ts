/** The legal pages and the cookie notice share these (and the e2e config pre-dismisses the notice with them). */

/** Shown as "Last updated" on the Terms, Privacy and Cookie pages. */
export const LEGAL_UPDATED = "1 November 2026";

export const LEGAL_DOCS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
] as const;

/**
 * Where the browser remembers that the cookie notice was seen. The value is the cookie policy's
 * version: change the policy in a way people should hear about, bump it, and the notice returns.
 */
export const COOKIE_NOTICE_KEY = "reverie-cookie-notice";
export const COOKIE_NOTICE_VERSION = "2026-10-29";
