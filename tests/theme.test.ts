import { describe, expect, it } from 'vitest';

import {
  otherTheme,
  parseTheme,
  resolveTheme,
} from '../src/theme';

describe('theme resolution', () => {
  it('uses a stored choice before the system preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system when no valid choice is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('auto', true)).toBe('dark');
  });

  it('parses only supported theme values', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('system')).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it('toggles between themes', () => {
    expect(otherTheme('light')).toBe('dark');
    expect(otherTheme('dark')).toBe('light');
  });
});
