import { createHash } from 'node:crypto';

import type { CliUpdateManifest } from './update-manifest';

export const MAX_ROLLOUT_DELAY_SECONDS = 86_400;

export function rolloutBucket(deviceId: string, version: string): number {
  const digest = createHash('sha256').update(`${deviceId}:${version}`, 'utf8').digest();
  return digest.readUInt32BE(0) % 100;
}

export function rolloutDelayForBucket(
  rollout: CliUpdateManifest['rollout'],
  bucket: number,
): number {
  let cumulative = 0;
  for (const batch of rollout) {
    cumulative += batch.percent;
    if (bucket < cumulative) {
      return Math.min(Math.max(batch.delaySeconds, 0), MAX_ROLLOUT_DELAY_SECONDS);
    }
  }
  return rollout.length === 0 ? 0 : MAX_ROLLOUT_DELAY_SECONDS;
}

export function isRolloutEligible(
  manifest: CliUpdateManifest,
  deviceId: string,
  now: Date,
): boolean {
  const publishedAt = Date.parse(manifest.publishedAt);
  if (!Number.isFinite(publishedAt)) return true;
  const delaySeconds = rolloutDelayForBucket(
    manifest.rollout,
    rolloutBucket(deviceId, manifest.version),
  );
  return now.getTime() >= publishedAt + delaySeconds * 1000;
}
