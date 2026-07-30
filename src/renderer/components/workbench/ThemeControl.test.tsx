import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeControl } from './ThemeControl';

describe('ThemeControl', () => {
  it('exposes three radio options and changes preference', async () => {
    const onChange = vi.fn();
    render(<ThemeControl theme={{ preference: 'system', resolved: 'dark' }} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '跟随系统' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('radio', { name: '浅色' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
