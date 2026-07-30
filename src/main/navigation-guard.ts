export function isTrustedNavigation(url: string, rendererUrl: string): boolean {
  try {
    const destination = new URL(url);
    const trusted = new URL(rendererUrl);
    if (destination.protocol !== trusted.protocol) return false;
    if (trusted.protocol === 'file:') return destination.href === trusted.href;
    return destination.origin === trusted.origin;
  } catch {
    return false;
  }
}
