import { describe, expect, it, vi } from 'vitest';

import { fetchLatestCliRelease, UpdateManifestSchema } from './update-manifest';

describe('update manifest', () => {
  it('accepts future fields and defaults rollout to an empty list', () => {
    expect(
      UpdateManifestSchema.parse({
        version: '0.31.0',
        publishedAt: '2026-07-30T00:00:00.000Z',
        channel: 'stable',
      }),
    ).toEqual({
      version: '0.31.0',
      publishedAt: '2026-07-30T00:00:00.000Z',
      rollout: [],
    });
  });

  it('rejects malformed versions timestamps and rollout batches', () => {
    expect(() =>
      UpdateManifestSchema.parse({ version: 'next', publishedAt: 'today', rollout: [] }),
    ).toThrow();
    expect(() =>
      UpdateManifestSchema.parse({
        version: '0.31.0',
        publishedAt: '2026-07-30T00:00:00Z',
        rollout: [{ percent: 101, delaySeconds: -1 }],
      }),
    ).toThrow();
  });

  it('prefers latest.json', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          version: '0.31.0',
          publishedAt: '2026-07-30T00:00:00.000Z',
          rollout: [{ percent: 20, delaySeconds: 0 }],
        }),
        { status: 200 },
      ),
    );

    await expect(fetchLatestCliRelease(fetchImpl)).resolves.toMatchObject({
      latest: '0.31.0',
      manifest: { version: '0.31.0' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to the plain-text endpoint when the manifest is unavailable', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response(' v0.31.0\n', { status: 200 }));

    await expect(fetchLatestCliRelease(fetchImpl)).resolves.toEqual({
      latest: '0.31.0',
      manifest: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws when both release sources fail', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{bad json', { status: 200 }))
      .mockResolvedValueOnce(new Response('not-a-version', { status: 200 }));

    await expect(fetchLatestCliRelease(fetchImpl)).rejects.toThrow('invalid stable version');
  });
});
