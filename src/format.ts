import type { Website } from './types';

const numberFormatter = new Intl.NumberFormat('en-US');

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const relativeFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
});

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : '0';
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(fractionDigits)}%`;
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function truncate(value: string, max = 160): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  if (max <= 1) return '…';
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonthYear(iso: string): string {
  const date = parseDate(iso);
  return date
    ? `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : '—';
}

export function formatFullDate(iso: string): string {
  const date = parseDate(iso);
  return date
    ? `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : '—';
}

export function formatPulledAt(epochMs: number, timeZone?: string): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return '—';

  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(timeZone ? { timeZone } : {}),
    }).formatToParts(date);
  } catch {
    return '—';
  }

  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const day = get('day');
  const month = Number(get('month'));
  const year = get('year');
  const hour = get('hour').padStart(2, '0');
  const minute = get('minute').padStart(2, '0');

  if (!day || !year || !Number.isInteger(month) || month < 1 || month > 12) {
    return '—';
  }

  return `${day} ${MONTH_NAMES[month - 1]} ${year}, ${hour}:${minute}`;
}

export function formatDateKey(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function formatDayLabel(dateKey: string): string {
  const date = parseDate(`${dateKey}T00:00:00Z`);
  return date
    ? `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`
    : dateKey;
}

export function formatMonthShort(dateKey: string): string {
  const date = parseDate(`${dateKey}T00:00:00Z`);
  return date ? MONTH_NAMES[date.getUTCMonth()] : dateKey;
}

export function formatRelative(iso: string | null, now = Date.now()): string {
  const date = parseDate(iso);
  const current = new Date(now);
  if (!date || Number.isNaN(current.getTime())) return '—';

  const dayMs = 86_400_000;
  const targetDay = Date.parse(formatDateKey(date));
  const currentDay = Date.parse(formatDateKey(current));
  const diffDays = Math.round((targetDay - currentDay) / dayMs);

  if (diffDays === 0) return 'today';
  if (Math.abs(diffDays) < 30) return relativeFormatter.format(diffDays, 'day');
  if (Math.abs(diffDays) < 365) {
    return relativeFormatter.format(Math.round(diffDays / 30.44), 'month');
  }
  return relativeFormatter.format(Math.round(diffDays / 365.25), 'year');
}

export function normalizeWebsite(raw: string | null): Website | null {
  if (!raw) return null;

  let value = raw.trim();
  if (!value) return null;

  if (value.startsWith('//')) {
    value = `https:${value}`;
  } else if (
    /^[a-z][a-z\d+.-]*:\/\//i.test(value) &&
    !/^https?:\/\//i.test(value)
  ) {
    return null;
  } else if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.host || url.username || url.password) return null;

  const host = url.host.replace(/^www\./i, '');
  const path = url.pathname.replace(/\/+$/, '');

  return {
    href: url.toString(),
    label: `${host}${path}`,
  };
}

export function stripHash(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}
