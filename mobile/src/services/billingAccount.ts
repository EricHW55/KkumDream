import { sha256Hex } from '../utils/sha256';

export function getObfuscatedAccountId(userId: string): string {
  return sha256Hex(`kkumdream-google-play-account:${userId}`);
}
