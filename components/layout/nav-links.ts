export type NavLink = {
  href: string;
  label: string;
  /** Hidden on tablet widths, where the bar is tight (Home: the logo goes there too). */
  wideOnly?: boolean;
};

export const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Home", wideOnly: true },
  { href: "/search", label: "Search" },
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/streaming", label: "Streaming" },
  { href: "/about", label: "About" },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}
