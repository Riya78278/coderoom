import { z } from "zod";

/**
 * Join codes use an unambiguous alphabet — 0/O and 1/I are excluded so a
 * code read aloud over a call can't be misheard. Format: XXX-XXX (dashes
 * added for display only; joining accepts either form).
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const joinCodeSchema = z
  .string()
  .transform(normalizeJoinCode)
  .pipe(z.string().length(6, "Room code must be exactly 6 characters."));

export function formatJoinCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
