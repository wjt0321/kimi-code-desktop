export interface ParsedStartupAccess {
  readonly origin: string;
  readonly token: string;
}

export function parseStartupAccess(line: string): ParsedStartupAccess | undefined {
  const match = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?#token=([^\s&]+)/i.exec(line);
  if (!match) return undefined;

  const url = new URL(match[0]);
  return { origin: url.origin, token: match[1] };
}

export function redactStartupLine(line: string): string {
  return line.replace(/([#?&]token=)[^\s&]+/gi, '$1[REDACTED]');
}
