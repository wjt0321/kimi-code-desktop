/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8');

describe('workbench layout', () => {
  it('keeps the app shell at viewport height so the composer footer cannot be pushed below the window', () => {
    expect(styles).toMatch(/\.workbench\s*\{[^}]*height:\s*100vh;[^}]*min-height:\s*0;/);
    expect(styles).toMatch(/\.workbench-rail\s*\{[^}]*min-height:\s*0;/);
    expect(styles).toMatch(/\.workbench-sidebar\s*\{[^}]*min-height:\s*0;/);
    expect(styles).toMatch(/\.workbench-canvas\s*\{[^}]*min-height:\s*0;/);
  });
});
