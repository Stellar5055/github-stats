import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  formatDateKey,
  formatDayLabel,
  formatFullDate,
  formatMonthShort,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatPulledAt,
  formatRelative,
  normalizeWebsite,
  pluralize,
  truncate,
} from '../src/format';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});

describe('formatPercent', () => {
  it('formats whole percentages by default', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(42)).toBe('42%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('honors fraction digits', () => {
    expect(formatPercent(4.26, 1)).toBe('4.3%');
    expect(formatPercent(33.333, 1)).toBe('33.3%');
  });
});

describe('pluralize', () => {
  it('uses the singular for one', () => {
    expect(pluralize(1, 'repo')).toBe('1 repo');
  });

  it('uses the plural for zero and many', () => {
    expect(pluralize(0, 'repo')).toBe('0 repos');
    expect(pluralize(1234, 'star')).toBe('1,234 stars');
  });

  it('accepts an explicit plural', () => {
    expect(pluralize(2, 'repository', 'repositories')).toBe('2 repositories');
  });
});

describe('truncate', () => {
  it('collapses whitespace', () => {
    expect(truncate('  Hello   world  ')).toBe('Hello world');
  });

  it('leaves text at or under the limit unchanged', () => {
    expect(truncate('abcdefghij', 10)).toBe('abcdefghij');
  });

  it('adds an ellipsis when cutting', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('handles empty text and tiny limits', () => {
    expect(truncate('', 5)).toBe('');
    expect(truncate('abc', 1)).toBe('…');
  });
});

describe('date formatting', () => {
  const joined = '2011-09-03T15:26:22Z';
  const pulled = Date.parse('2026-11-12T14:32:00Z');

  it('formats month and year', () => {
    expect(formatMonthYear(joined)).toBe('Sep 2011');
  });

  it('formats a full date', () => {
    expect(formatFullDate(joined)).toBe('3 Sep 2011');
  });

  it('formats a pulled timestamp in a given time zone', () => {
    expect(formatPulledAt(pulled, 'UTC')).toBe('12 Nov 2026, 14:32');
  });

  it('formats chart labels', () => {
    expect(formatDayLabel('2026-11-03')).toBe('3 Nov');
    expect(formatMonthShort('2026-11-03')).toBe('Nov');
  });

  it('builds UTC date keys', () => {
    expect(formatDateKey(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-12');
    expect(formatDateKey(new Date('invalid'))).toBe('');
  });

  it('falls back for invalid dates', () => {
    expect(formatMonthYear('nope')).toBe('—');
    expect(formatFullDate('nope')).toBe('—');
    expect(formatPulledAt(Number.NaN, 'UTC')).toBe('—');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');

  it('uses calendar days', () => {
    expect(formatRelative('2026-11-12T08:00:00Z', now)).toBe('today');
    expect(formatRelative('2026-11-11T23:00:00Z', now)).toBe('yesterday');
    expect(formatRelative('2026-11-09T08:00:00Z', now)).toBe('3 days ago');
  });

  it('rolls up to months and years', () => {
    expect(formatRelative('2026-09-12T08:00:00Z', now)).toBe('2 months ago');
    expect(formatRelative('2024-11-12T08:00:00Z', now)).toBe('2 years ago');
  });

  it('handles future dates', () => {
    expect(formatRelative('2026-11-15T08:00:00Z', now)).toBe('in 3 days');
  });

  it('handles missing and invalid dates', () => {
    expect(formatRelative(null, now)).toBe('—');
    expect(formatRelative('nope', now)).toBe('—');
  });
});

describe('normalizeWebsite', () => {
  it('returns null for empty or unsafe values', () => {
    expect(normalizeWebsite(null)).toBeNull();
    expect(normalizeWebsite('')).toBeNull();
    expect(normalizeWebsite('   ')).toBeNull();
    expect(normalizeWebsite('javascript:alert(1)')).toBeNull();
    expect(normalizeWebsite('mailto:hi@example.com')).toBeNull();
    expect(normalizeWebsite('ftp://example.com')).toBeNull();
    expect(normalizeWebsite('https://user:pass@example.com')).toBeNull();
  });

  it('adds https and strips www for labels', () => {
    expect(normalizeWebsite('example.com')).toEqual({
      href: 'https://example.com/',
      label: 'example.com',
    });
    expect(normalizeWebsite('https://www.example.com/foo/')).toEqual({
      href: 'https://www.example.com/foo/',
      label: 'example.com/foo',
    });
  });

  it('handles protocol-relative and port URLs', () => {
    expect(normalizeWebsite('//example.com')).toEqual({
      href: 'https://example.com/',
      label: 'example.com',
    });
    expect(normalizeWebsite('https://example.com:8080/a/')).toEqual({
      href: 'https://example.com:8080/a/',
      label: 'example.com:8080/a',
    });
  });

  it('preserves explicit http', () => {
    expect(normalizeWebsite('http://example.com')).toEqual({
      href: 'http://example.com/',
      label: 'example.com',
    });
  });
});
