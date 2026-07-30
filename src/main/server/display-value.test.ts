import { describe, expect, it } from 'vitest';

import { toDesktopDisplayValue } from './display-value';

describe('toDesktopDisplayValue', () => {
  it('preserves serializable scalars and nested records', () => {
    expect(toDesktopDisplayValue({ command: 'pnpm test', ok: true, count: 2 })).toEqual({
      type: 'object',
      entries: [
        { key: 'command', value: 'pnpm test' },
        { key: 'ok', value: true },
        { key: 'count', value: 2 },
      ],
    });
  });

  it('limits depth, entries and array items', () => {
    expect(toDesktopDisplayValue({ a: { b: { c: 'deep' } }, d: 1, e: 2 }, { maxDepth: 2, maxEntries: 2 })).toEqual({
      type: 'object',
      entries: [
        { key: 'a', value: { type: 'object', entries: [{ key: 'b', value: '[内容层级过深]' }] } },
        { key: 'd', value: 1 },
      ],
      truncated: true,
    });
    expect(toDesktopDisplayValue([1, 2, 3], { maxArrayItems: 2 })).toEqual({ type: 'array', items: [1, 2], truncated: true });
  });

  it('does not recurse forever for circular objects', () => {
    const input: Record<string, unknown> = {};
    input.self = input;
    expect(toDesktopDisplayValue(input)).toEqual({ type: 'object', entries: [{ key: 'self', value: '[循环引用]' }] });
  });

  it('truncates long strings and ignores unsupported values', () => {
    expect(toDesktopDisplayValue('123456', { maxStringLength: 4 })).toBe('1234…');
    expect(toDesktopDisplayValue(undefined)).toBeUndefined();
    expect(toDesktopDisplayValue(Symbol('hidden'))).toBe('Symbol(hidden)');
  });
});
