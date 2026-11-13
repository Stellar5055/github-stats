import type {
  ApiErrorKind,
  AppError,
  GitHubCommitSummary,
  GitHubEvent,
  GitHubReleaseSummary,
  GitHubRepo,
  GitHubRepoDetail,
  GitHubUser,
  ProfileData,
  RepoDetailData,
} from './types';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const MAX_REPO_PAGES = 3;
const MAX_EVENT_PAGES = 3;

interface PageResult<T> {
  items: T[];
  truncated: boolean;
}

export class GitHubApiError extends Error implements AppError {
  kind: ApiErrorKind;
  status?: number;
  resetAt?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; resetAt?: number } = {},
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.kind = kind;
    this.status = options.status;
    this.resetAt = options.resetAt;
  }
}

export function isGitHubApiError(error: unknown): error is GitHubApiError {
  return error instanceof GitHubApiError;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': API_VERSION,
      },
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new GitHubApiError('network', 'Could not reach GitHub.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError('not-found', 'GitHub user not found.', {
        status: 404,
      });
    }

    const remaining = response.headers.get('x-ratelimit-remaining');
    if (
      response.status === 429 ||
      (response.status === 403 && remaining === '0')
    ) {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      throw new GitHubApiError(
        'rate-limit',
        'GitHub API rate limit reached.',
        {
          status: response.status,
          resetAt: Number.isFinite(reset) && reset > 0 ? reset * 1000 : undefined,
        },
      );
    }

    throw new GitHubApiError('http', `GitHub returned ${response.status}.`, {
      status: response.status,
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new GitHubApiError('http', 'GitHub returned an invalid response.', {
      status: response.status,
    });
  }
}

async function paginate<T>(
  path: string,
  maxPages: number,
  signal?: AbortSignal,
): Promise<PageResult<T>> {
  const items: T[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await getJson<T[]>(
      `${API_ROOT}${path}${separator}per_page=100&page=${page}`,
      signal,
    );

    items.push(...batch);

    if (batch.length < 100) {
      return { items, truncated: false };
    }
  }

  return { items, truncated: true };
}

async function optional<T>(
  promise: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return fallback;
  }
}

export async function fetchRepoDetails(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<RepoDetailData> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const [repoData, languages, commits, release] = await Promise.all([
    getJson<GitHubRepoDetail>(`${API_ROOT}${path}`, signal),
    optional(
      getJson<Record<string, number>>(`${API_ROOT}${path}/languages`, signal),
      {},
    ),
    optional(
      getJson<GitHubCommitSummary[]>(
        `${API_ROOT}${path}/commits?per_page=1`,
        signal,
      ),
      [],
    ),
    optional(
      getJson<GitHubReleaseSummary[]>(
        `${API_ROOT}${path}/releases?per_page=1`,
        signal,
      ),
      [],
    ),
  ]);

  return {
    repo: repoData,
    languages,
    lastCommit: commits[0] ?? null,
    release: release[0] ?? null,
  };
}

export async function fetchProfile(
  handle: string,
  signal?: AbortSignal,
): Promise<ProfileData> {
  const encoded = encodeURIComponent(handle);
  const user = await getJson<GitHubUser>(`${API_ROOT}/users/${encoded}`, signal);

  const [repoResult, eventResult] = await Promise.all([
    user.public_repos > 0
      ? paginate<GitHubRepo>(
          `/users/${encoded}/repos?sort=pushed&direction=desc&type=owner`,
          MAX_REPO_PAGES,
          signal,
        )
      : Promise.resolve<PageResult<GitHubRepo>>({
          items: [],
          truncated: false,
        }),
    paginate<GitHubEvent>(
      `/users/${encoded}/events/public`,
      MAX_EVENT_PAGES,
      signal,
    ),
  ]);

  return {
    user,
    repos: repoResult.items,
    events: eventResult.items,
    fetchedAt: Date.now(),
    reposTruncated: user.public_repos > repoResult.items.length,
    eventsTruncated: eventResult.truncated,
  };
}
