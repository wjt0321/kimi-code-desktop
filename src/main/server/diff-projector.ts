import { basename } from 'node:path';

import type { DesktopDiffLine, DesktopDiffTarget } from '../../shared/contracts';

const MAX_DIFF_CELLS = 120_000;

export function buildToolDiff(
  toolName: string,
  inputValue: unknown,
  outputValue: unknown,
  id: string,
): DesktopDiffTarget | undefined {
  const category = toolName.toLowerCase();
  if (!category.includes('edit') && !category.includes('write')) return undefined;
  const input = asRecord(inputValue);
  const path = readString(input?.path) ?? readString(input?.file_path) ?? readString(input?.filePath);
  const fallbackOutput = displayText(outputValue);
  if (!path) return fallbackOutput ? { id, title: '文件变更', lines: [], fallbackOutput } : undefined;

  const title = fileName(path);
  if (category.includes('write')) {
    const content = readString(input?.content);
    if (content === undefined) return fallbackOutput ? { id, title, path, lines: [], fallbackOutput } : undefined;
    return {
      id,
      title,
      path,
      lines: splitLines(content).map((text, index) => ({ type: 'add', text, newNo: index + 1 })),
    };
  }

  const oldText = readString(input?.old_string) ?? readString(input?.oldString);
  const newText = readString(input?.new_string) ?? readString(input?.newString);
  if (oldText === undefined || newText === undefined) {
    return fallbackOutput ? { id, title, path, lines: [], fallbackOutput } : undefined;
  }

  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  if (oldLines.length * newLines.length > MAX_DIFF_CELLS) {
    return { id, title, path, lines: [], fallbackOutput, truncated: true };
  }
  return { id, title, path, lines: buildLineDiff(oldLines, newLines) };
}

function buildLineDiff(oldLines: string[], newLines: string[]): DesktopDiffLine[] {
  const rows = Array.from({ length: oldLines.length + 1 }, () => new Array<number>(newLines.length + 1).fill(0));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      rows[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? rows[oldIndex + 1][newIndex + 1] + 1
        : Math.max(rows[oldIndex + 1][newIndex], rows[oldIndex][newIndex + 1]);
    }
  }

  const result: DesktopDiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      result.push({ type: 'context', text: oldLines[oldIndex], oldNo: oldIndex + 1, newNo: newIndex + 1 });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }
    if (oldIndex < oldLines.length && (newIndex >= newLines.length || rows[oldIndex + 1][newIndex] >= rows[oldIndex][newIndex + 1])) {
      result.push({ type: 'del', text: oldLines[oldIndex], oldNo: oldIndex + 1 });
      oldIndex += 1;
      continue;
    }
    if (newIndex < newLines.length) {
      result.push({ type: 'add', text: newLines[newIndex], newNo: newIndex + 1 });
      newIndex += 1;
    }
  }
  return result;
}

function splitLines(value: string): string[] {
  const lines = value.replaceAll('\r\n', '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function fileName(value: string): string {
  return basename(value.replaceAll('\\', '/')) || value;
}

function displayText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value === undefined) return undefined;
  try {
    const text = JSON.stringify(value);
    return text.length > 20_000 ? `${text.slice(0, 20_000)}…` : text;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
