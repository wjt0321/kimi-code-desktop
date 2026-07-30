import { describe, expect, it } from 'vitest';

import { applyBootstrapTheme, resolveBootstrapTheme } from './bootstrap-theme';

describe('preload theme bootstrap', () => {
  it('tolerates a document whose root element has not been parsed yet', () => {
    expect(() => applyBootstrapTheme(null, ['--kimi-desktop-theme=light'])).not.toThrow();
    expect(applyBootstrapTheme(null, ['--kimi-desktop-theme=light'])).toBe(false);
  });

  it('applies only supported resolved themes', () => {
    const root = document.createElement('html');
    expect(applyBootstrapTheme(root, ['--kimi-desktop-theme=light'])).toBe(true);
    expect(root.dataset.theme).toBe('light');
    expect(resolveBootstrapTheme(['--kimi-desktop-theme=system'])).toBeUndefined();
  });
});
