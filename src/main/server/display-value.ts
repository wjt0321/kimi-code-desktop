import type { DesktopDisplayValue } from '../../shared/contracts';

export interface DisplayValueLimits {
  maxDepth?: number;
  maxEntries?: number;
  maxArrayItems?: number;
  maxStringLength?: number;
}

interface ResolvedLimits {
  maxDepth: number;
  maxEntries: number;
  maxArrayItems: number;
  maxStringLength: number;
}

const DEFAULT_LIMITS: ResolvedLimits = {
  maxDepth: 5,
  maxEntries: 80,
  maxArrayItems: 100,
  maxStringLength: 20_000,
};

export function toDesktopDisplayValue(
  value: unknown,
  limits: DisplayValueLimits = {},
): DesktopDisplayValue | undefined {
  const resolved: ResolvedLimits = {
    maxDepth: limits.maxDepth ?? DEFAULT_LIMITS.maxDepth,
    maxEntries: limits.maxEntries ?? DEFAULT_LIMITS.maxEntries,
    maxArrayItems: limits.maxArrayItems ?? DEFAULT_LIMITS.maxArrayItems,
    maxStringLength: limits.maxStringLength ?? DEFAULT_LIMITS.maxStringLength,
  };
  return convertValue(value, resolved, new WeakSet<object>(), 0);
}

function convertValue(
  value: unknown,
  limits: ResolvedLimits,
  seen: WeakSet<object>,
  depth: number,
): DesktopDisplayValue | undefined {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return truncateText(value, limits.maxStringLength);
  if (value === undefined) return undefined;
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') return truncateText(String(value), limits.maxStringLength);
  if (typeof value !== 'object') return undefined;
  if (seen.has(value)) return '[循环引用]';
  if (depth >= limits.maxDepth) return '[内容层级过深]';

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const visible = value.slice(0, limits.maxArrayItems);
      const items = visible.flatMap((item) => {
        const converted = convertValue(item, limits, seen, depth + 1);
        return converted === undefined ? [] : [converted];
      });
      return {
        type: 'array',
        items,
        truncated: value.length > visible.length ? true : undefined,
      };
    }

    let keys: string[];
    try {
      keys = Object.keys(value);
    } catch {
      return '[无法读取内容]';
    }
    const visibleKeys = keys.slice(0, limits.maxEntries);
    const entries = visibleKeys.flatMap((key) => {
      let child: unknown;
      try {
        child = (value as Record<string, unknown>)[key];
      } catch {
        child = '[无法读取字段]';
      }
      const converted = convertValue(child, limits, seen, depth + 1);
      return converted === undefined ? [] : [{ key, value: converted }];
    });
    return {
      type: 'object',
      entries,
      truncated: keys.length > visibleKeys.length ? true : undefined,
    };
  } finally {
    seen.delete(value);
  }
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength))}…`;
}
