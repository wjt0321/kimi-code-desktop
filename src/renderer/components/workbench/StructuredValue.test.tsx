import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StructuredValue } from './StructuredValue';

afterEach(cleanup);

describe('StructuredValue', () => {
  it('renders nested object and array values', () => {
    render(<StructuredValue value={{
      type: 'object',
      entries: [
        { key: 'command', value: 'pnpm test' },
        { key: 'flags', value: { type: 'array', items: ['--run', true] } },
      ],
    }} />);
    expect(screen.getByText('command')).not.toBeNull();
    expect(screen.getByText('pnpm test')).not.toBeNull();
    expect(screen.getByText('--run')).not.toBeNull();
    expect(screen.getByText('true')).not.toBeNull();
  });

  it('marks truncated values clearly', () => {
    render(<StructuredValue value={{ type: 'array', items: ['one'], truncated: true }} />);
    expect(screen.getByText('内容已截断')).not.toBeNull();
  });
});
