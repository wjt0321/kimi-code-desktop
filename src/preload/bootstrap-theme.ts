import type { ResolvedTheme } from '../shared/contracts';

export function resolveBootstrapTheme(argv: readonly string[]): ResolvedTheme | undefined {
  const value = argv.find((argument) => argument.startsWith('--kimi-desktop-theme='))?.split('=')[1];
  return value === 'light' || value === 'dark' ? value : undefined;
}

export function applyBootstrapTheme(
  root: HTMLElement | null,
  argv: readonly string[],
): boolean {
  const theme = resolveBootstrapTheme(argv);
  if (root === null || theme === undefined) return false;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  return true;
}
