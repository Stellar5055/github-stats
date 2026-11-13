import { fetchProfile, fetchRepoDetails, isGitHubApiError } from './api';
import { readCache, writeCache } from './cache';
import { deriveProfile } from './derive';
import { formatPulledAt, formatUpdated, truncate } from './format';
import { parseHandle } from './parse';
import {
  INITIAL_VISIBLE_REPOS,
  REPO_BATCH_SIZE,
  renderActivitySection,
  renderError,
  renderLoading,
  renderProfile,
  renderReposSection,
} from './render';
import {
  renderRepoDetails,
  renderRepoDetailsError,
  renderRepoDetailsLoading,
} from './repo-dialog';
import { initTheme, syncThemeButtons } from './theme';
import type {
  AppError,
  ProfileView,
  RepoDetailData,
  SortKey,
} from './types';

const app = document.querySelector<HTMLDivElement>('#app');
const boot = document.querySelector<HTMLDivElement>('#boot');
const status = document.querySelector<HTMLDivElement>('#status');

initTheme();

let currentView: ProfileView | null = null;
let currentHandle = '';
let currentSort: SortKey = 'stars';
let shownRepos = INITIAL_VISIBLE_REPOS;
let activityWindow: 30 | 90 = 90;
let controller: AbortController | null = null;
const repoDetailCache = new Map<string, RepoDetailData>();
let repoDetailController: AbortController | null = null;

function clearBoot(): void {
  document.documentElement.classList.remove('is-loading');
  boot?.remove();
}

function setApp(html: string): void {
  if (!app) return;

  const dialog = app.querySelector<HTMLDialogElement>('#repo-dialog');
  if (dialog?.open) dialog.close();

  document.documentElement.classList.remove('dialog-open');
  repoDetailController?.abort();
  app.innerHTML = html;
  syncThemeButtons();
}

function announce(message: string): void {
  if (status) status.textContent = message;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function toAppError(error: unknown): AppError {
  if (isGitHubApiError(error)) return error;

  return {
    kind: 'http',
    message: error instanceof Error ? error.message : 'Unknown error',
  };
}

interface LoadOptions {
  force?: boolean;
  preserveUi?: boolean;
}

function defaultActivityWindow(view: ProfileView): 30 | 90 {
  return view.recentActivity.totalEvents > 0 ? 30 : 90;
}

async function load(
  raw: string,
  options: LoadOptions = {},
): Promise<void> {
  const parsed = parseHandle(raw);

  if (!parsed.ok) {
    currentView = null;
    clearBoot();
    setApp(renderError({ kind: 'invalid', message: parsed.reason }, raw.trim()));
    announce(parsed.reason);
    return;
  }

  const handle = parsed.handle;
  currentHandle = handle;
  const previousScroll = options.preserveUi ? window.scrollY : 0;

  if (!options.preserveUi) {
    currentSort = 'stars';
    shownRepos = INITIAL_VISIBLE_REPOS;
  }

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get('u') !== handle) {
    currentUrl.searchParams.set('u', handle);
    window.history.replaceState(null, '', currentUrl);
  }

  controller?.abort();
  controller = new AbortController();

  const cached = readCache(handle);

  if (cached && !cached.stale && !options.force) {
    currentView = deriveProfile(cached.data);
    if (!options.preserveUi) {
      activityWindow = defaultActivityWindow(currentView);
    }
    clearBoot();
    renderCurrent(previousScroll);
    announce(`Profile loaded for ${handle}.`);
    return;
  }

  clearBoot();
  setApp(renderLoading(handle));
  announce(`Looking up ${handle}.`);

  try {
    const data = await fetchProfile(handle, controller.signal);
    writeCache(data);
    currentView = deriveProfile(data);
    if (!options.preserveUi) {
      activityWindow = defaultActivityWindow(currentView);
    }
    renderCurrent(previousScroll);
    announce(`Profile loaded for ${handle}.`);
  } catch (error) {
    if (isAbortError(error)) return;

    if (
      cached &&
      isGitHubApiError(error) &&
      (error.kind === 'rate-limit' || error.kind === 'network')
    ) {
      currentView = deriveProfile(cached.data);
      if (!options.preserveUi) {
        activityWindow = defaultActivityWindow(currentView);
      }
      currentView.notices.push(
        `Showing the last saved profile from ${formatPulledAt(cached.data.fetchedAt)}.`,
      );
      renderCurrent(previousScroll);
      announce('Showing a cached profile because GitHub could not be reached.');
      return;
    }

    const appError = toAppError(error);
    currentView = null;
    clearBoot();
    setApp(renderError(appError, handle));
    announce(
      appError.kind === 'not-found'
        ? `No GitHub user named ${handle}.`
        : 'Could not load the profile.',
    );
  }
}

function renderCurrent(scrollTop = 0): void {
  if (!currentView) return;

  setApp(
    renderProfile(currentView, {
      sort: currentSort,
      shown: shownRepos,
      activityWindow,
    }),
  );
  updateMeta(currentView);
  window.scrollTo(0, scrollTop);
}

function updateMeta(view: ProfileView): void {
  const title = `@${view.handle} — GitHub Stats`;
  document.title = title;

  const description = view.bio
    ? truncate(view.bio, 160)
    : `${view.displayName} (@${view.handle}) — public repositories, languages, stars, and recent activity.`;

  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
}

function setMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void {
  const element = document.querySelector(`meta[${attribute}="${key}"]`);
  element?.setAttribute('content', content);
}

function rerenderRepos(
  focus: 'sort' | 'more' | 'fewer',
  previousShown = INITIAL_VISIBLE_REPOS,
): void {
  if (!currentView) return;

  const section = document.querySelector<HTMLElement>('#repos');
  if (!section) return;

  section.outerHTML = renderReposSection(currentView, {
    sort: currentSort,
    shown: shownRepos,
  });

  if (focus === 'sort') {
    document
      .querySelector<HTMLButtonElement>(`[data-sort="${currentSort}"]`)
      ?.focus();
  } else if (focus === 'more') {
    document
      .querySelectorAll<HTMLAnchorElement>('.repo-name')
      [previousShown]?.focus();
  } else {
    document.querySelector<HTMLElement>('#repos-title')?.focus();
  }
}

function rerenderActivity(): void {
  if (!currentView) return;

  const section = document.querySelector<HTMLElement>('#activity');
  if (!section) return;

  section.outerHTML = renderActivitySection(
    currentView,
    activityWindow,
  );

  document
    .querySelector<HTMLButtonElement>(
      `[data-activity-window="${activityWindow}"]`,
    )
    ?.focus();
}

function closeRepoDialog(): void {
  document.querySelector<HTMLDialogElement>('#repo-dialog')?.close();
}

async function openRepoDetails(
  owner: string,
  repo: string,
): Promise<void> {
  const dialog = document.querySelector<HTMLDialogElement>('#repo-dialog');
  const content = document.querySelector<HTMLDivElement>(
    '#repo-dialog-content',
  );
  if (!dialog || !content) return;

  const key = `${owner}/${repo}`.toLowerCase();
  const cached = repoDetailCache.get(key);

  const showDialog = (): void => {
    if (dialog.open) return;

    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    dialog.addEventListener(
      'close',
      () => {
        document.documentElement.classList.remove('dialog-open');
        repoDetailController?.abort();
      },
      { once: true },
    );
  };

  if (cached) {
    content.innerHTML = renderRepoDetails(cached);
    showDialog();
    return;
  }

  content.innerHTML = renderRepoDetailsLoading(owner, repo);
  showDialog();

  repoDetailController?.abort();
  repoDetailController = new AbortController();

  try {
    const details = await fetchRepoDetails(
      owner,
      repo,
      repoDetailController.signal,
    );

    repoDetailCache.set(key, details);
    if (!content.isConnected) return;
    content.innerHTML = renderRepoDetails(details);
  } catch (error) {
    if (isAbortError(error) || !content.isConnected) return;

    const message =
      isGitHubApiError(error) && error.kind === 'rate-limit'
        ? 'GitHub’s API limit is used up. Try again later.'
        : 'Could not load repository details.';

    content.innerHTML = renderRepoDetailsError(owner, repo, message);
  }
}

async function copyLink(button: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    button.textContent = 'Copied';
    window.setTimeout(() => {
      button.textContent = 'Copy link';
    }, 1500);
  } catch {
    button.textContent = 'Copy failed';
    window.setTimeout(() => {
      button.textContent = 'Copy link';
    }, 1500);
  }
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target instanceof HTMLDialogElement && target.id === 'repo-dialog') {
    target.close();
    return;
  }

  const activityButton = target.closest<HTMLButtonElement>(
    '[data-activity-window]',
  );
  if (activityButton) {
    const value = activityButton.dataset.activityWindow;
    if (value === '30' || value === '90') {
      activityWindow = Number(value) as 30 | 90;
      rerenderActivity();
    }
    return;
  }

  const sortButton = target.closest<HTMLButtonElement>('[data-sort]');
  if (sortButton) {
    const key = sortButton.dataset.sort;
    if (key !== 'stars' && key !== 'recent' && key !== 'name') return;

    currentSort = key;
    rerenderRepos('sort');
    return;
  }

  const actionTarget = target.closest<HTMLElement>('[data-action]');
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === 'show-more') {
    if (!currentView) return;
    const previousShown = shownRepos;
    shownRepos = Math.min(
      currentView.repos.length,
      shownRepos + REPO_BATCH_SIZE,
    );
    rerenderRepos('more', previousShown);
  } else if (action === 'show-fewer') {
    shownRepos = INITIAL_VISIBLE_REPOS;
    rerenderRepos('fewer');
  } else if (action === 'print') {
    window.print();
  } else if (action === 'copy') {
    void copyLink(actionTarget);
  } else if (action === 'refresh') {
    if (!currentHandle) return;
    void load(currentHandle, { force: true, preserveUi: true });
  } else if (action === 'repo-details') {
    const owner = actionTarget.dataset.owner;
    const repo = actionTarget.dataset.repo;
    if (owner && repo) void openRepoDetails(owner, repo);
  } else if (action === 'close-repo') {
    closeRepoDialog();
  } else if (action === 'retry') {
    void load(currentHandle);
  }
});

window.setInterval(() => {
  if (!currentView) return;
  const note = document.querySelector<HTMLElement>('.updated-note');
  if (note) {
    note.textContent = `Updated ${formatUpdated(currentView.fetchedAt)}`;
  }
}, 60_000);

const raw = new URLSearchParams(window.location.search).get('u');

if (!raw) {
  clearBoot();
} else {
  void load(raw);
}
