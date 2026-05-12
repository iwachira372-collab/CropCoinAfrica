import * as crypto from 'crypto';

/**
 * Generate a random secure token
 * @param length Token length in bytes (default 32 = 256 bits)
 * @returns Hex-encoded random token
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token using SHA256
 * @param token Token to hash
 * @returns Hashed token in hex format
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 * @param token Original token
 * @param hash Stored hash
 * @returns True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}
