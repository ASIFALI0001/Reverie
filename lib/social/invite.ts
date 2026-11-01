/** No 0/1/i/l/o: easy to read aloud and type from a printed card. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const INVITE_CODE_LENGTH = 10;
export const INVITE_CODE_RE = new RegExp(`^[${ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** A random invite code. Rejection sampling keeps every character equally likely. */
export function newInviteCode(length = INVITE_CODE_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit) out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}
