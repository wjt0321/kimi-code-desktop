import { describe, expect, it } from 'vitest';

import { projectToolFrame } from './tool-projector';

describe('projectToolFrame', () => {
  it.each([
    ['Shell', { command: 'pnpm test', cwd: 'D:/repo' }, 'shell'],
    ['Read', { path: 'README.md' }, 'read'],
    ['Write', { path: 'a.ts', content: 'x' }, 'write'],
    ['Edit', { path: 'a.ts', old_string: 'a', new_string: 'b' }, 'edit'],
    ['Search', { query: 'needle' }, 'search'],
    ['WebFetch', { url: 'https://example.test' }, 'web'],
    ['Agent', { description: '检查测试' }, 'agent'],
    ['TaskOutput', { task_id: 'task-1' }, 'task'],
    ['TodoWrite', { items: [] }, 'todo'],
  ])('classifies %s as %s', (name, input, category) => {
    expect(projectToolFrame({ frameId: 'frame-1', toolCallId: 'call-1', name, state: 'running', input })?.category).toBe(category);
  });

  it('extracts shell fields and progress', () => {
    expect(projectToolFrame({
      frameId: 'frame-1',
      toolCallId: 'call-1',
      name: 'Shell',
      state: 'running',
      input: { command: 'pnpm test', cwd: 'D:/repo' },
      progress: { kind: 'progress', text: '一半', percent: 0.5 },
      approvalId: 'approval-1',
      taskId: 'task-1',
    })).toMatchObject({
      title: '运行命令',
      summary: 'pnpm test',
      command: 'pnpm test',
      cwd: 'D:/repo',
      progress: { kind: 'progress', text: '一半', percent: 50 },
      approvalId: 'approval-1',
      taskId: 'task-1',
    });
  });

  it('preserves unknown tools through the generic fallback', () => {
    expect(projectToolFrame({ frameId: 'f', name: 'FutureTool', state: 'done', input: { feature: true }, output: { ok: true } })).toMatchObject({
      category: 'generic',
      title: 'FutureTool',
      summary: 'FutureTool 已完成',
      input: { type: 'object' },
      output: { type: 'object' },
    });
  });

  it('rejects malformed frames', () => {
    expect(projectToolFrame({ frameId: 'f', name: '', state: 'done' })).toBeUndefined();
    expect(projectToolFrame({ frameId: 'f', name: 'Shell', state: 'unknown' })).toBeUndefined();
  });
});
