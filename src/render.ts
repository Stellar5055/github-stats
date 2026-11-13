import {
  escapeHtml,
  formatDayLabel,
  formatFullDate,
  formatMonthShort,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatPulledAt,
  formatRelative,
  pluralize,
} from './format';
import { sortRepos } from './derive';
import { renderRepoDialogShell } from './repo-dialog';
import type {
  ActivityView,
  AppError,
  Detail,
  LanguageSlice,
  ProfileView,
  RepoItem,
  SortKey,
  Stat,
} from './types';

export interface RepoUiState {
  sort: SortKey;
  showAll: boolean;
}

export function renderProfile(
  view: ProfileView,
  ui: RepoUiState,
): string {
  return `<div class="page">
    ${siteHeader('profile')}
    <main class="profile shell">
      ${renderPrintMasthead(view)}
      ${renderIdentity(view)}
      ${renderStats(view.stats)}
      ${renderNotices(view)}
      ${renderLanguages(view)}
      <div class="content-grid">
        ${renderReposSection(view, ui)}
        ${renderDetails(view)}
      </div>
      ${renderActivity(view)}
      ${renderFinePrint(view)}
      <div class="profile-actions no-print">
        <button type="button" class="button button-secondary" data-action="print">Print this page</button>
        <button type="button" class="button button-quiet" data-action="refresh">Refresh</button>
        <button type="button" class="button button-quiet" data-action="copy">Copy link</button>
        <a class="button button-quiet" href="./">Search another</a>
      </div>
    </main>
    ${renderRepoDialogShell()}
    ${siteFooter()}
  </div>`;
}

function renderPrintMasthead(view: ProfileView): string {
  return `<div class="print-only print-masthead">
    <div>
      <p class="print-brand">GitHub Stats.</p>
      <p class="print-masthead-label">Public profile record</p>
    </div>
    <div class="print-masthead-meta">
      <span>github.com/${escapeHtml(view.handle)}</span>
      <span>Fetched ${escapeHtml(formatPulledAt(view.fetchedAt))}</span>
    </div>
  </div>`;
}

export function renderLoading(handle: string): string {
  return `<div class="page">
    ${siteHeader('profile')}
    <main class="loading-page shell" aria-busy="true">
      <p class="mono-label">Looking up</p>
      <h1 class="loading-title">@${escapeHtml(handle)}</h1>
      <div class="loading-line" role="progressbar" aria-label="Loading profile"></div>
      <p class="loading-note">Contacting the GitHub API…</p>
    </main>
    ${siteFooter()}
  </div>`;
}

export function renderError(error: AppError, handle = ''): string {
  const copy = errorCopy(error);
  const canRetry = error.kind === 'network' || error.kind === 'http';

  return `<div class="page">
    ${siteHeader('profile')}
    <main class="error-page shell">
      <p class="mono-label error-code">${escapeHtml(copy.code)}</p>
      <h1 class="error-title">${escapeHtml(copy.title)}</h1>
      <p class="error-copy">${escapeHtml(copy.body)}</p>
      ${renderSearchForm(handle)}
      ${canRetry ? `<div class="error-actions"><button type="button" class="button button-secondary" data-action="retry">Try again</button></div>` : ''}
      <p class="error-back"><a href="./">← Back to search</a></p>
    </main>
    ${siteFooter()}
  </div>`;
}

export function renderReposSection(
  view: ProfileView,
  ui: RepoUiState,
): string {
  const sorted = sortRepos(view.repos, ui.sort);
  const rows = sorted.map((repo) => renderRepo(repo, view.handle)).join('');
  const showToggle =
    view.repos.length > 8
      ? `<button type="button" class="show-all no-print" data-action="toggle-repos" aria-expanded="${ui.showAll}" aria-controls="repo-list">${ui.showAll ? 'Show fewer' : `Show all ${formatNumber(view.repos.length)}`}</button>`
      : '';

  const body = view.repos.length
    ? `<div class="repo-head" aria-hidden="true">
        <span>Repository</span>
        <span>Language</span>
        <span>Stars</span>
        <span>Pushed</span>
      </div>
      <ol class="repo-list${ui.showAll ? '' : ' is-collapsed'}" id="repo-list">${rows}</ol>
      ${showToggle}`
    : `<div class="empty-state">
        <p>${view.forkCount > 0 ? 'No original repositories. Only forks were found.' : 'No public repositories yet.'}</p>
      </div>`;

  return `<section class="section repos-section" id="repos" aria-labelledby="repos-title">
    <div class="section-head">
      <h2 id="repos-title" class="section-title">Repositories</h2>
      <span class="section-note">${escapeHtml(formatNumber(view.analyzedRepoCount))}</span>
    </div>
    ${view.repos.length > 10 ? `<p class="print-only print-note">First 10 of ${escapeHtml(formatNumber(view.repos.length))} repositories shown in print.</p>` : ''}
    <div class="repo-toolbar no-print">
      <span class="toolbar-label">Sort</span>
      <div class="sort-buttons" role="group" aria-label="Sort repositories">
        ${renderSortButton('stars', 'Stars', ui.sort)}
        ${renderSortButton('recent', 'Recent', ui.sort)}
        ${renderSortButton('name', 'Name', ui.sort)}
      </div>
    </div>
    ${body}
  </section>`;
}

function renderIdentity(view: ProfileView): string {
  const meta: string[] = [];

  if (view.meta.location) {
    meta.push(
      `<span class="meta-item">${escapeHtml(view.meta.location)}</span>`,
    );
  }

  if (view.meta.company) {
    const company = view.meta.company;
    const companyHandle = company.startsWith('@')
      ? company.slice(1)
      : null;

    meta.push(
      companyHandle
        ? `<span class="meta-item"><a href="${escapeHtml(`https://github.com/${companyHandle}`)}" target="_blank" rel="noreferrer">${escapeHtml(company)}</a></span>`
        : `<span class="meta-item">${escapeHtml(company)}</span>`,
    );
  }

  if (view.meta.website) {
    meta.push(
      `<span class="meta-item"><a href="${escapeHtml(view.meta.website.href)}" target="_blank" rel="noreferrer">${escapeHtml(view.meta.website.label)}</a></span>`,
    );
  }

  meta.push(
    `<span class="meta-item">Joined ${escapeHtml(formatMonthYear(view.meta.joinedAt))}</span>`,
  );

  return `<section class="identity" aria-labelledby="profile-name">
    <img
      class="avatar"
      src="${escapeHtml(view.avatarUrl)}"
      alt="GitHub avatar of ${escapeHtml(view.displayName)}"
      width="96"
      height="96"
    />
    <div class="identity-body">
      ${view.isOrg ? '<p class="profile-kind">Organization</p>' : ''}
      <h1 id="profile-name" class="profile-name">${escapeHtml(view.displayName)}</h1>
      <p class="profile-handle">@${escapeHtml(view.handle)}</p>
      ${view.bio ? `<p class="profile-bio">${escapeHtml(view.bio)}</p>` : ''}
      <div class="profile-meta">${meta.join('')}</div>
    </div>
    <a class="profile-link no-print" href="${escapeHtml(view.profileUrl)}" target="_blank" rel="noreferrer">Open on GitHub <span aria-hidden="true">↗</span></a>
  </section>`;
}

function renderStats(stats: Stat[]): string {
  return `<div class="stats" role="group" aria-label="Profile statistics">
    ${stats
      .map(
        (stat) => `<div class="stat stat--${stat.key}">
          <span class="stat-value">${escapeHtml(stat.value)}</span>
          <span class="stat-label">${escapeHtml(stat.label)}</span>
        </div>`,
      )
      .join('')}
  </div>`;
}

function renderNotices(view: ProfileView): string {
  if (view.notices.length === 0) return '';

  return `<div class="notices">
    ${view.notices
      .map((notice) => `<p class="notice">${escapeHtml(notice)}</p>`)
      .join('')}
  </div>`;
}

function renderLanguages(view: ProfileView): string {
  const languages = view.languages;

  const body =
    languages.length > 0
      ? `<div class="language-bar" role="img" aria-label="${escapeHtml(languageSummary(languages))}">
          ${languages
            .map(
              (slice, index) =>
                `<span class="language-segment language-tone-${index}${slice.isOther ? ' is-other' : ''}" style="width:${slice.percent.toFixed(2)}%"></span>`,
            )
            .join('')}
        </div>
        <ul class="language-legend">
          ${languages
            .map(
              (slice, index) => `<li class="language-item">
                <span class="language-swatch language-tone-${index}${slice.isOther ? ' is-other' : ''}" aria-hidden="true"></span>
                <span class="language-name">${escapeHtml(slice.name)}</span>
                <span class="language-share">${escapeHtml(formatPercent(slice.percent, slice.percent < 10 ? 1 : 0))}</span>
                <span class="language-repos">${escapeHtml(pluralize(slice.count, 'repo'))}</span>
              </li>`,
            )
            .join('')}
        </ul>
        <p class="section-footnote">By primary language, per repository.</p>`
      : `<div class="empty-state"><p>No primary language recorded.</p></div>`;

  return `<section class="section languages-section" aria-labelledby="languages-title">
    <div class="section-head">
      <h2 id="languages-title" class="section-title">Languages</h2>
      <span class="section-note">${escapeHtml(formatNumber(view.analyzedRepoCount))} repos</span>
    </div>
    ${body}
  </section>`;
}

function languageSummary(languages: LanguageSlice[]): string {
  return `Language distribution: ${languages
    .map((slice) => `${slice.name} ${pluralize(slice.count, 'repo')}`)
    .join(', ')}`;
}

function renderRepo(repo: RepoItem, owner: string): string {
  const description = repo.description
    ? `<p class="repo-description">${escapeHtml(repo.description)}</p>`
    : '';
  const language = repo.language ? escapeHtml(repo.language) : '—';
  const pushed = repo.pushedAt
    ? escapeHtml(formatRelative(repo.pushedAt))
    : '—';
  const pushedTitle = repo.pushedAt
    ? escapeHtml(formatFullDate(repo.pushedAt))
    : '';
  const archived = repo.archived
    ? '<span class="repo-flag">Archived</span>'
    : '';

  return `<li class="repo-item">
    <div class="repo-main">
      <div class="repo-title-row">
        <a class="repo-name" href="${escapeHtml(repo.url)}" target="_blank" rel="noreferrer">${escapeHtml(repo.name)}</a>
        ${archived}
        <button type="button" class="repo-details no-print" data-action="repo-details" data-owner="${escapeHtml(owner)}" data-repo="${escapeHtml(repo.name)}" aria-haspopup="dialog" aria-controls="repo-dialog" aria-label="Details for ${escapeHtml(repo.name)}">Details</button>
      </div>
      ${description}
    </div>
    <div class="repo-meta">
      <span class="repo-cell repo-language" data-label="Language">${language}</span>
      <span class="repo-cell repo-stars" data-label="Stars">${escapeHtml(formatNumber(repo.stars))}</span>
      <span class="repo-cell repo-updated" data-label="Pushed" title="${pushedTitle}">${pushed}</span>
    </div>
  </li>`;
}

function renderSortButton(
  key: SortKey,
  label: string,
  active: SortKey,
): string {
  const selected = key === active;

  return `<button type="button" class="sort-button${selected ? ' is-active' : ''}" data-sort="${key}" aria-pressed="${selected}">${label}</button>`;
}

function renderDetails(view: ProfileView): string {
  const rows = view.details.map(renderDetail).join('');

  return `<aside class="section details-section" aria-labelledby="details-title">
    <h2 id="details-title" class="section-title">Details</h2>
    ${
      rows
        ? `<dl class="details-list">${rows}</dl>`
        : '<div class="empty-state"><p>No public details.</p></div>'
    }
  </aside>`;
}

function renderDetail(detail: Detail): string {
  const value = detail.href
    ? `<a href="${escapeHtml(detail.href)}" target="_blank" rel="noreferrer">${escapeHtml(detail.value)}</a>`
    : escapeHtml(detail.value);

  return `<div class="detail">
    <dt>${escapeHtml(detail.label)}</dt>
    <dd>${value}</dd>
  </div>`;
}

function renderActivity(view: ProfileView): string {
  const activity = view.activity;

  const body =
    activity.totalEvents > 0
      ? `<p class="activity-summary"><strong>${escapeHtml(formatNumber(activity.activeDays))}</strong> active days <span class="summary-sep">·</span> <strong>${escapeHtml(formatNumber(activity.totalEvents))}</strong> public events</p>
        ${renderActivityChart(activity)}
        <div class="activity-axis">
          <span>${escapeHtml(formatMonthShort(activity.days[0].date))}</span>
          <span>${escapeHtml(formatMonthShort(activity.days[30].date))}</span>
          <span>${escapeHtml(formatMonthShort(activity.days[60].date))}</span>
          <span>Today</span>
        </div>
        ${
          activity.mix.length > 0
            ? `<ul class="event-mix">
                ${activity.mix
                  .map(
                    (item) =>
                      `<li><span>${escapeHtml(item.label)}</span><span>${escapeHtml(formatNumber(item.count))}</span></li>`,
                  )
                  .join('')}
              </ul>`
            : ''
        }
        ${activity.truncated ? '<p class="section-footnote">Based on the 300 most recent public events.</p>' : ''}`
      : `<div class="empty-state">
          <p>No public events in the last 90 days.</p>
          <p>Private work stays private.</p>
        </div>`;

  return `<section class="section activity-section" aria-labelledby="activity-title">
    <div class="section-head">
      <h2 id="activity-title" class="section-title">Activity</h2>
      <span class="section-note">Last 90 days</span>
    </div>
    ${body}
  </section>`;
}

function renderActivityChart(activity: ActivityView): string {
  const width = 900;
  const height = 72;
  const gap = 4;
  const barWidth =
    (width - gap * (activity.days.length - 1)) / activity.days.length;
  const max = Math.max(1, activity.peakCount);

  const bars = activity.days
    .map((day, index) => {
      const barHeight =
        day.count === 0
          ? 2
          : Math.max(3, Math.round((day.count / max) * (height - 8)));
      const x = index * (barWidth + gap);
      const y = height - barHeight;
      const peak =
        day.count > 0 && activity.busiestDay?.date === day.date;
      const className = `activity-bar${peak ? ' is-peak' : ''}${day.count === 0 ? ' is-empty' : ''}`;
      const title = `${formatDayLabel(day.date)} — ${pluralize(day.count, 'event')}`;

      return `<rect class="${className}" x="${x.toFixed(2)}" y="${y}" width="${barWidth.toFixed(2)}" height="${barHeight}" rx="1"><title>${escapeHtml(title)}</title></rect>`;
    })
    .join('');

  const label = `Activity over the last 90 days: ${pluralize(activity.totalEvents, 'public event')} across ${pluralize(activity.activeDays, 'active day')}.`;

  return `<svg class="activity-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(label)}">${bars}</svg>`;
}

function renderFinePrint(view: ProfileView): string {
  const repoLabel =
    view.analyzedRepoCount === view.repoTotal
      ? pluralize(view.analyzedRepoCount, 'public repo')
      : `${formatNumber(view.analyzedRepoCount)} of ${pluralize(view.repoTotal, 'public repo')}`;
  const forkNote =
    view.forkCount > 0
      ? ` ${pluralize(view.forkCount, 'fork')} excluded.`
      : '';

  return `<section class="fine-print">
    <p>Fetched ${escapeHtml(formatPulledAt(view.fetchedAt))} · ${escapeHtml(repoLabel)} analyzed.${escapeHtml(forkNote)}</p>
    <p>Public data only. Not affiliated with GitHub.</p>
  </section>`;
}

function errorCopy(error: AppError): {
  code: string;
  title: string;
  body: string;
} {
  switch (error.kind) {
    case 'not-found':
      return {
        code: '404 / Not found',
        title: 'No user under that name.',
        body: 'Check the spelling, or paste the full GitHub profile URL.',
      };
    case 'rate-limit':
      return {
        code: '403 / Rate limit',
        title: 'GitHub’s API limit is used up.',
        body: error.resetAt
          ? `Try again after ${formatPulledAt(error.resetAt)}.`
          : 'Try again in a little while.',
      };
    case 'network':
      return {
        code: 'Network',
        title: 'Couldn’t reach GitHub.',
        body: 'Check your connection and try again.',
      };
    case 'invalid':
      return {
        code: 'Invalid input',
        title: 'That doesn’t look like a profile.',
        body: 'Use a GitHub username or a github.com profile link.',
      };
    default:
      return {
        code: 'GitHub error',
        title: 'GitHub returned an error.',
        body: 'Try again in a moment.',
      };
  }
}

function renderSearchForm(value: string): string {
  return `<form class="search error-search" action="./" method="get">
    <label class="search-label" for="handle">GitHub username or profile URL</label>
    <div class="search-row">
      <input
        class="search-input"
        id="handle"
        name="u"
        type="text"
        value="${escapeHtml(value)}"
        placeholder="sindresorhus"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        maxlength="200"
        required
      />
      <button type="submit" class="button button-primary">Look up</button>
    </div>
  </form>`;
}

export function siteHeader(mode: 'landing' | 'profile'): string {
  return `<header class="site-header">
    <div class="shell header-inner">
      <a class="wordmark" href="./">GitHub Stats<span class="wordmark-dot">.</span></a>
      ${
        mode === 'profile'
          ? '<a class="header-link no-print" href="./">New search</a>'
          : '<span class="header-note">Public data only</span>'
      }
    </div>
  </header>`;
}

export function siteFooter(): string {
  return `<footer class="site-footer">
    <div class="shell footer-inner">
      <span>GitHub Stats</span>
      <span>
        Public data from the GitHub API. Not affiliated with GitHub.
        <a class="footer-link" href="./method.html">How it works</a>
        <a class="footer-link" href="https://github.com/Stellar5055/github-stats" target="_blank" rel="noreferrer">Source <span aria-hidden="true">↗</span></a>
      </span>
    </div>
  </footer>`;
}
