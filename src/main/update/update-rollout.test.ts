import { describe, expect, it } from 'vitest';

import {
  MAX_ROLLOUT_DELAY_SECONDS,
  isRolloutEligible,
  rolloutBucket,
  rolloutDelayForBucket,
} from './update-rollout';

const manifest = {
  version: '0.31.0',
  publishedAt: '2026-07-30T00:00:00.000Z',
  rollout: [
    { percent: 10, delaySeconds: 0 },
    { percent: 40, delaySeconds: 3600 },
  ],
} as const;

describe('CLI update rollout', () => {
  it('assigns deterministic buckets per device and version', () => {
    expect(rolloutBucket('device-a', '0.31.0')).toBe(rolloutBucket('device-a', '0.31.0'));
    expect(rolloutBucket('device-a', '0.31.0')).toBeGreaterThanOrEqual(0);
    expect(rolloutBucket('device-a', '0.31.0')).toBeLessThan(100);
  });

  it('uses ordered rollout cohorts and delays uncovered devices by at most 24 hours', () => {
    expect(rolloutDelayForBucket(manifest.rollout, 0)).toBe(0);
    expect(rolloutDelayForBucket(manifest.rollout, 9)).toBe(0);
    expect(rolloutDelayForBucket(manifest.rollout, 10)).toBe(3600);
    expect(rolloutDelayForBucket(manifest.rollout, 49)).toBe(3600);
    expect(rolloutDelayForBucket(manifest.rollout, 50)).toBe(MAX_ROLLOUT_DELAY_SECONDS);
    expect(rolloutDelayForBucket([{ percent: 100, delaySeconds: 999999 }], 99)).toBe(
      MAX_ROLLOUT_DELAY_SECONDS,
    );
  });

  it('reveals a release when the selected delay has elapsed', () => {
    expect(isRolloutEligible(manifest, 'device-a', new Date('2026-07-31T00:00:00.000Z'))).toBe(
      true,
    );
    expect(
      isRolloutEligible(
        { ...manifest, rollout: [{ percent: 100, delaySeconds: 3600 }] },
        'device-a',
        new Date('2026-07-30T00:30:00.000Z'),
      ),
    ).toBe(false);
  });
});
