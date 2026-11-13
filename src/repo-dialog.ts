import {
  escapeHtml,
  formatFullDate,
  formatNumber,
  formatPercent,
  formatRelative,
  normalizeWebsite,
} from './format';
import type { RepoDetailData } from './types';

interface LanguageSlice {
  name: string;
  bytes: number;
  percent: number;
  isOther?: boolean;
}

function languageSlices(languages: Record<string, number>): LanguageSlice[] {
  const entries = Object.entries(languages)
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total === 0) return [];

  const slices: LanguageSlice[] = entries.slice(0, 6).map(([name, bytes]) => ({
    name,
    bytes,
    percent: Math.round((bytes / total) * 1000) / 10,
  }));

  const other = entries
    .slice(6)
    .reduce((sum, [, bytes]) => sum + bytes, 0);

  if (other > 0) {
    slices.push({
      name: 'Other',
      bytes: other,
      percent: Math.round((other / total) * 1000) / 10,
      isOther: true,
    });
  }

  return slices;
}

function renderLanguageBar(slices: LanguageSlice[]): string {
  const summary = slices
    .map(
      (slice) =>
        `${slice.name} ${formatPercent(slice.percent, slice.percent < 10 ? 1 : 0)}`,
    )
    .join(', ');

  return `<div class="language-bar" role="img" aria-label="${escapeHtml(`Language bytes: ${summary}`)}">
    ${slices
      .map(
        (slice, index) =>
          `<span class="language-segment language-tone-${index}${slice.isOther ? ' is-other' : ''}" style="width:${slice.percent.toFixed(2)}%"></span>`,
      )
      .join('')}
  </div>
  <ul class="repo-dialog-language-list">
    ${slices
      .map(
        (slice, index) => `<li>
          <span class="language-swatch language-tone-${index}${slice.isOther ? ' is-other' : ''}" aria-hidden="true"></span>
          <span>${escapeHtml(slice.name)}</span>
          <span class="repo-dialog-language-share">${escapeHtml(formatPercent(slice.percent, slice.percent < 10 ? 1 : 0))}</span>
        </li>`,
      )
      .join('')}
  </ul>`;
}

export function renderRepoDialogShell(): string {
  return `<dialog class="repo-dialog" id="repo-dialog" aria-labelledby="repo-dialog-title">
    <div class="repo-dialog-inner">
      <button type="button" class="repo-dialog-close" data-action="close-repo" aria-label="Close repository details">×</button>
      <div id="repo-dialog-content"></div>
    </div>
  </dialog>`;
}

export function renderRepoDetailsLoading(
  owner: string,
  repo: string,
): string {
  return `<p class="mono-label">Repository</p>
    <h2 id="repo-dialog-title" class="repo-dialog-title">${escapeHtml(repo)}</h2>
    <p class="repo-dialog-sub">${escapeHtml(owner)}/${escapeHtml(repo)}</p>
    <div class="loading-line"></div>
    <p class="loading-note">Loading repository details…</p>`;
}

export function renderRepoDetailsError(
  owner: string,
  repo: string,
  message: string,
): string {
  const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  return `<p class="mono-label">Repository</p>
    <h2 id="repo-dialog-title" class="repo-dialog-title">${escapeHtml(repo)}</h2>
    <p class="repo-dialog-error">${escapeHtml(message)}</p>
    <a class="button button-secondary" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open on GitHub <span aria-hidden="true">↗</span></a>`;
}

export function renderRepoDetails(data: RepoDetailData): string {
  const repo = data.repo;
  const description = repo.description?.trim() ?? '';
  const homepage = normalizeWebsite(repo.homepage);
  const languages = languageSlices(data.languages);

  const license = repo.license
    ? repo.license.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
      ? repo.license.spdx_id
      : repo.license.name
    : '—';

  const lastPush = repo.pushed_at
    ? `<span title="${escapeHtml(formatFullDate(repo.pushed_at))}">${escapeHtml(formatRelative(repo.pushed_at))}</span>`
    : '—';

  const commit = data.lastCommit;
  const commitMessage = commit
    ? commit.commit.message.split('\n')[0]?.trim() || 'No commit message'
    : '';
  const commitAuthor = commit
    ? commit.author?.login ?? commit.commit.author?.name ?? 'Unknown'
    : '';
  const commitDate = commit?.commit.author?.date ?? '';
  const release = data.release;
  const topics = (repo.topics ?? []).filter(Boolean);

  return `<p class="mono-label">Repository</p>
    <h2 id="repo-dialog-title" class="repo-dialog-title">${escapeHtml(repo.name)}</h2>
    <p class="repo-dialog-sub">
      ${escapeHtml(repo.full_name)} · ${escapeHtml(repo.default_branch)}
      ${repo.archived ? ' · Archived' : ''}
    </p>

    ${description ? `<p class="repo-dialog-description">${escapeHtml(description)}</p>` : ''}

    <div class="repo-dialog-stats">
      <div>
        <strong>${escapeHtml(formatNumber(repo.stargazers_count))}</strong>
        <span>Stars</span>
      </div>
      <div>
        <strong>${escapeHtml(formatNumber(repo.forks_count))}</strong>
        <span>Forks</span>
      </div>
      <div>
        <strong>${escapeHtml(formatNumber(repo.open_issues_count))}</strong>
        <span>Open issues &amp; PRs</span>
      </div>
    </div>

    ${
      homepage
        ? `<p class="repo-dialog-home"><a href="${escapeHtml(homepage.href)}" target="_blank" rel="noreferrer">${escapeHtml(homepage.label)} <span aria-hidden="true">↗</span></a></p>`
        : ''
    }

    ${
      languages.length > 0
        ? `<section class="repo-dialog-section">
            <h3>Languages</h3>
            ${renderLanguageBar(languages)}
          </section>`
        : ''
    }

    ${
      commit
        ? `<section class="repo-dialog-section">
            <h3>Last commit</h3>
            <p class="repo-dialog-commit">${escapeHtml(commitMessage)}</p>
            <p class="repo-dialog-sub">
              ${escapeHtml(commitAuthor)} ·
              <a href="${escapeHtml(commit.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(commit.sha.slice(0, 7))}</a>
              ${commitDate ? `· <span title="${escapeHtml(formatFullDate(commitDate))}">${escapeHtml(formatRelative(commitDate))}</span>` : ''}
            </p>
          </section>`
        : ''
    }

    ${
      release
        ? `<section class="repo-dialog-section">
            <h3>Latest release</h3>
            <p class="repo-dialog-release">
              <a href="${escapeHtml(release.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(release.tag_name)}</a>
              ${release.name ? ` — ${escapeHtml(release.name)}` : ''}
            </p>
            <p class="repo-dialog-sub">
              ${release.published_at ? `<span title="${escapeHtml(formatFullDate(release.published_at))}">${escapeHtml(formatRelative(release.published_at))}</span>` : ''}
              ${release.prerelease ? ' · Pre-release' : ''}
            </p>
          </section>`
        : ''
    }

    <section class="repo-dialog-section">
      <h3>Details</h3>
      <dl class="repo-dialog-details">
        <div>
          <dt>Created</dt>
          <dd>${escapeHtml(formatFullDate(repo.created_at))}</dd>
        </div>
        <div>
          <dt>Last push</dt>
          <dd>${lastPush}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>${escapeHtml(license)}</dd>
        </div>
        <div>
          <dt>Default branch</dt>
          <dd>${escapeHtml(repo.default_branch)}</dd>
        </div>
      </dl>
      ${
        topics.length > 0
          ? `<p class="repo-dialog-topics"><span class="mono-label">Topics</span> ${topics.map((topic) => escapeHtml(topic)).join(' · ')}</p>`
          : ''
      }
    </section>

    <div class="repo-dialog-actions">
      <a class="button button-secondary" href="${escapeHtml(repo.html_url)}" target="_blank" rel="noreferrer">Open on GitHub <span aria-hidden="true">↗</span></a>
    </div>`;
}
