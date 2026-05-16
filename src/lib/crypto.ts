import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM at-rest encryption for connector credentials.
 *
 * Output format (base64):  iv || authTag || ciphertext
 *   - 12-byte IV (96-bit, NIST-recommended for GCM)
 *   - 16-byte authentication tag (GCM tag)
 *   - variable-length ciphertext
 *
 * The key lives in $ENCRYPTION_KEY (base64-encoded 32 bytes). Rotate by
 * decrypting with the old key, re-encrypting with the new — the format stays
 * the same, and a key-version prefix can be added later if needed.
 */

const ALG = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY env var is not set. Generate one with `openssl rand -base64 32`."
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes; got ${buf.length}. Use 'openssl rand -base64 32'.`
    );
  }
  cachedKey = buf;
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(cipherB64: string): string {
  const buf = Buffer.from(cipherB64, "base64");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("Ciphertext too short");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

/** Convenience: encrypt a JSON value. */
export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}
export function decryptJson<T>(cipher: string): T {
  return JSON.parse(decrypt(cipher)) as T;
}
