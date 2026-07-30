import { describe, expect, it } from 'vitest';

import { compareStableVersions, normalizeStableVersion } from './version';

describe('stable version helpers', () => {
  it('normalizes stable semantic versions', () => {
    expect(normalizeStableVersion('  v0.30.0  ')).toBe('0.30.0');
    expect(normalizeStableVersion('1.2.3')).toBe('1.2.3');
  });

  it('rejects prerelease, build metadata, incomplete and malformed values', () => {
    for (const value of ['0.31.0-beta.1', '0.31.0+build', '0.31', 'latest', '1.2.03']) {
      expect(normalizeStableVersion(value)).toBeNull();
    }
  });

  it('compares numeric version components', () => {
    expect(compareStableVersions('0.30.0', '0.31.0')).toBeLessThan(0);
    expect(compareStableVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareStableVersions('2.0.0', '2.0.0')).toBe(0);
  });
});
