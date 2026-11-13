import { fetchProfile, fetchRepoDetails, isGitHubApiError } from './api';
import { readCache, writeCache } from './cache';
import {
  fetchContributions,
  hasContributionProxy,
  renderContributions,
} from './contributions';
import { deriveProfile } from './derive';
import { formatPulledAt, truncate } from './format';
import { parseHandle } from './parse';
import {
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
import type {
  AppError,
  ProfileView,
  RepoDetailData,
  SortKey,
} from './types';

const app = document.querySelector<HTMLDivElement>('#app');
const boot = document.querySelector<HTMLDivElement>('#boot');
const status = document.querySelector<HTMLDivElement>('#status');

let currentView: ProfileView | null = null;
let currentHandle = '';
let currentSort: SortKey = 'stars';
let showAllRepos = false;
let controller: AbortController | null = null;
const repoDetailCache = new Map<string, RepoDetailData>();
let repoDetailController: AbortController | null = null;
let contributionsController: AbortController | null = null;

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
  contributionsController?.abort();
  app.innerHTML = html;
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

async function load(raw: string, force = false): Promise<void> {
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
  currentSort = 'stars';
  showAllRepos = false;

  controller?.abort();
  controller = new AbortController();

  const cached = readCache(handle);

  if (cached && !cached.stale && !force) {
    currentView = deriveProfile(cached.data);
    clearBoot();
    renderCurrent();
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
    renderCurrent();
    announce(`Profile loaded for ${handle}.`);
  } catch (error) {
    if (isAbortError(error)) return;

    if (
      cached &&
      isGitHubApiError(error) &&
      (error.kind === 'rate-limit' || error.kind === 'network')
    ) {
      currentView = deriveProfile(cached.data);
      currentView.notices.push(
        `Showing the last saved profile from ${formatPulledAt(cached.data.fetchedAt)}.`,
      );
      renderCurrent();
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

function renderCurrent(): void {
  if (!currentView) return;

  setApp(
    renderProfile(currentView, {
      sort: currentSort,
      showAll: showAllRepos,
    }),
  );
  updateMeta(currentView);
  window.scrollTo(0, 0);
  void loadContributions(currentView.handle);
}

async function loadContributions(handle: string): Promise<void> {
  if (!hasContributionProxy) return;

  const section = document.querySelector<HTMLElement>('#contributions');
  const body = document.querySelector<HTMLElement>('#contributions-body');
  if (!section || !body) return;

  contributionsController?.abort();
  contributionsController = new AbortController();

  try {
    const data = await fetchContributions(
      handle,
      contributionsController.signal,
    );

    if (currentHandle !== handle) return;

    if (data.viewer?.toLowerCase() === handle.toLowerCase()) {
      section.hidden = true;
      body.innerHTML = '';
      return;
    }

    body.innerHTML = renderContributions(data);
    section.hidden = false;
  } catch (error) {
    if (isAbortError(error)) return;
    section.hidden = true;
    body.innerHTML = '';
  }
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

function rerenderRepos(focus: 'sort' | 'toggle'): void {
  if (!currentView) return;

  const section = document.querySelector<HTMLElement>('#repos');
  if (!section) return;

  section.outerHTML = renderReposSection(currentView, {
    sort: currentSort,
    showAll: showAllRepos,
  });

  if (focus === 'sort') {
    document
      .querySelector<HTMLButtonElement>(`[data-sort="${currentSort}"]`)
      ?.focus();
  } else {
    document
      .querySelector<HTMLButtonElement>('[data-action="toggle-repos"]')
      ?.focus();
  }
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

  if (action === 'toggle-repos') {
    showAllRepos = !showAllRepos;
    rerenderRepos('toggle');
  } else if (action === 'print') {
    window.print();
  } else if (action === 'copy') {
    void copyLink(actionTarget);
  } else if (action === 'refresh') {
    if (!currentHandle) return;
    void load(currentHandle, true);
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

const raw = new URLSearchParams(window.location.search).get('u');

if (!raw) {
  clearBoot();
} else {
  void load(raw);
}
