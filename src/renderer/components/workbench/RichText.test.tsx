import { render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RichText } from './RichText';

afterEach(() => cleanup());

describe('RichText', () => {
  it('renders fenced code separately from prose without interpreting HTML', () => {
    render(<RichText text={'先执行：\n```ts\nconst value = 1;\n```\n<script>alert(1)</script>'} />);
    expect(screen.getByText('const value = 1;')).not.toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).not.toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });
});
