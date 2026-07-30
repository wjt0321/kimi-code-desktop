import { describe, expect, it } from 'vitest';

import { buildToolDiff } from './diff-projector';

describe('buildToolDiff', () => {
  it('builds a line diff for a single edit', () => {
    const diff = buildToolDiff('Edit', {
      path: 'src/app.ts',
      old_string: 'const value = 1;\nconsole.log(value);\n',
      new_string: 'const value = 2;\nconsole.log(value);\n',
    }, undefined, 'call-1');

    expect(diff).toMatchObject({ id: 'call-1', title: 'app.ts', path: 'src/app.ts' });
    expect(diff?.lines).toEqual([
      { type: 'del', text: 'const value = 1;', oldNo: 1 },
      { type: 'add', text: 'const value = 2;', newNo: 1 },
      { type: 'context', text: 'console.log(value);', oldNo: 2, newNo: 2 },
    ]);
  });

  it('treats a new write as additions', () => {
    expect(buildToolDiff('Write', { file_path: 'notes.txt', content: 'one\ntwo' }, undefined, 'call-2')?.lines).toEqual([
      { type: 'add', text: 'one', newNo: 1 },
      { type: 'add', text: 'two', newNo: 2 },
    ]);
  });

  it('uses a fallback when the diff matrix is too large', () => {
    const oldText = Array.from({ length: 600 }, (_, index) => `old-${index}`).join('\n');
    const newText = Array.from({ length: 600 }, (_, index) => `new-${index}`).join('\n');
    expect(buildToolDiff('Edit', { path: 'big.txt', old_string: oldText, new_string: newText }, 'changed', 'call-3')).toMatchObject({
      lines: [],
      fallbackOutput: 'changed',
      truncated: true,
    });
  });

  it('does not invent a diff for unsupported edit shapes', () => {
    expect(buildToolDiff('Edit', { path: 'a.ts', edits: [] }, 'done', 'call-4')).toEqual({
      id: 'call-4',
      title: 'a.ts',
      path: 'a.ts',
      lines: [],
      fallbackOutput: 'done',
    });
    expect(buildToolDiff('Read', { path: 'a.ts' }, undefined, 'call-5')).toBeUndefined();
  });
});
