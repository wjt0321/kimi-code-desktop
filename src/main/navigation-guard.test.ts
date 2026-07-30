import { describe, expect, it } from 'vitest';

import { isTrustedNavigation } from './navigation-guard';

describe('isTrustedNavigation', () => {
  it('allows the packaged renderer entrypoint and rejects every other file URL', () => {
    const renderer = 'file:///D:/app/dist/renderer/index.html';

    expect(isTrustedNavigation(renderer, renderer)).toBe(true);
    expect(isTrustedNavigation('file:///D:/app/other.html', renderer)).toBe(false);
    expect(isTrustedNavigation('https://example.test/', renderer)).toBe(false);
  });

  it('allows only the Vite renderer origin during development', () => {
    const renderer = 'http://localhost:5173/';

    expect(isTrustedNavigation('http://localhost:5173/settings', renderer)).toBe(true);
    expect(isTrustedNavigation('http://127.0.0.1:5173/', renderer)).toBe(false);
    expect(isTrustedNavigation('https://example.test/', renderer)).toBe(false);
  });
});
