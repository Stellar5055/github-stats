import {
  escapeHtml,
  formatDayLabel,
  formatNumber,
  pluralize,
} from './format';
import type {
  ContributionData,
  ContributionDay,
} from './types';

const PROXY_URL = (
  import.meta.env.VITE_CONTRIB_PROXY_URL as string | undefined
)?.trim() ?? '';

export const hasContributionProxy = PROXY_URL.length > 0;

export async function fetchContributions(
  login: string,
  signal?: AbortSignal,
): Promise<ContributionData> {
  if (!PROXY_URL) {
    throw new Error('No contribution proxy configured.');
  }

  const url = new URL(PROXY_URL);
  if (!url.pathname.endsWith('/contributions')) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/contributions`;
  }
  url.searchParams.set('login', login);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Contribution proxy returned ${response.status}.`);
  }

  const data = (await response.json()) as ContributionData;

  if (
    !data ||
    typeof data.total !== 'number' ||
    !Array.isArray(data.weeks)
  ) {
    throw new Error('Invalid contribution data.');
  }

  return data;
}

function level(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  return Math.min(4, 1 + Math.floor((count / max) * 4));
}

function bestDay(days: ContributionDay[]): ContributionDay | null {
  return days.reduce<ContributionDay | null>(
    (best, day) => (!best || day.count > best.count ? day : best),
    null,
  );
}

export function renderContributions(data: ContributionData): string {
  const days = data.weeks.flatMap((week) => week.days);
  const activeDays = days.filter((day) => day.count > 0).length;
  const max = days.reduce((value, day) => Math.max(value, day.count), 0);
  const best = bestDay(days);

  return `<div class="contribution-summary">
      <div>
        <strong>${escapeHtml(formatNumber(data.total))}</strong>
        <span>contributions</span>
      </div>
      <div>
        <strong>${escapeHtml(formatNumber(activeDays))}</strong>
        <span>active days</span>
      </div>
      <div>
        <strong>${best && best.count > 0 ? escapeHtml(formatDayLabel(best.date)) : '—'}</strong>
        <span>${best && best.count > 0 ? escapeHtml(`best day · ${pluralize(best.count, 'contribution')}`) : 'best day'}</span>
      </div>
    </div>
    <div class="contribution-calendar" role="img" aria-label="${escapeHtml(`${formatNumber(data.total)} contributions in the last 12 months.`)}">
      ${data.weeks
        .map(
          (week) => `<div class="contribution-week">
            ${week.days
              .map(
                (day) =>
                  `<span class="contribution-day level-${level(day.count, max)}" title="${escapeHtml(`${formatDayLabel(day.date)} — ${pluralize(day.count, 'contribution')}`)}"></span>`,
              )
              .join('')}
          </div>`,
        )
        .join('')}
    </div>
    <p class="contribution-note">Public contributions from the last 12 months.</p>`;
}
