const STABLE_VERSION = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function normalizeStableVersion(value: string): string | null {
  const match = STABLE_VERSION.exec(value.trim());
  if (match === null) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return null;
  return parts.join('.');
}

function versionParts(value: string): readonly [number, number, number] {
  const normalized = normalizeStableVersion(value);
  if (normalized === null) {
    throw new Error(`invalid stable version: ${JSON.stringify(value)}`);
  }
  const [major, minor, patch] = normalized.split('.').map(Number);
  return [major, minor, patch];
}

export function compareStableVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < a.length; index += 1) {
    const difference = a[index] - b[index];
    if (difference !== 0) return difference;
  }
  return 0;
}
