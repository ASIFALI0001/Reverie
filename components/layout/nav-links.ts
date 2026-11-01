export type NavLink = { href: string; label: string };

export const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/about", label: "About" },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}
