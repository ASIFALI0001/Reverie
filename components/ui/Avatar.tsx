/* eslint-disable @next/next/no-img-element -- remote profile photos (Google) bypass the image loader */
import { cn } from "@/lib/cn";
import { TINT_HEX, isAvatarTint } from "@/lib/avatar";

export { TINT_HEX };

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  return (parts.length === 1 ? parts[0]!.slice(0, 1) : `${parts[0]![0]}${parts[parts.length - 1]![0]}`).toUpperCase();
}

type AvatarProps = {
  name: string | null | undefined;
  photoURL?: string | null;
  avatar?: { kind: "photo" | "monogram"; tint: string } | null;
  size?: number;
  className?: string;
};

/** Google photo when chosen and available, otherwise a serif monogram on a muted tint. */
export function Avatar({ name, photoURL, avatar, size = 32, className }: AvatarProps) {
  const style = { width: size, height: size };
  if (avatar?.kind === "photo" && photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        style={style}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  // The monogram is drawn, not written (CSS generated content): it's a picture of a name, so it
  // never competes with the label of the button it sits in.
  return (
    <span
      aria-hidden="true"
      data-initials={initials(name)}
      style={{ ...style, background: TINT_HEX[avatar?.tint && isAvatarTint(avatar.tint) ? avatar.tint : "tungsten"], fontSize: size * 0.42 }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display leading-none text-[#141210] after:content-[attr(data-initials)]",
        className,
      )}
    />
  );
}
