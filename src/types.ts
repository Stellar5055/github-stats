/**
 * Narrow GitHub API types and the view model used by the UI.
 *
 * These interfaces only describe the fields this app reads. The GitHub API
 * returns more fields than this; extra JSON properties are ignored.
 */

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string | null;
  url: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  license: GitHubLicense | null;
  created_at: string;
  pushed_at: string | null;
}

export interface GitHubRepoDetail {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: GitHubLicense | null;
  topics?: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

export interface GitHubCommitSummary {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
}

export interface GitHubReleaseSummary {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
}

export interface RepoDetailData {
  repo: GitHubRepoDetail;
  languages: Record<string, number>;
  lastCommit: GitHubCommitSummary | null;
  release: GitHubReleaseSummary | null;
}

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: {
    id: number;
    name: string;
    url: string;
  };
}

export interface ProfileData {
  user: GitHubUser;
  /** Owned public repositories, including forks. Capped at 300. */
  repos: GitHubRepo[];
  /** Public events, newest first. Capped at 300. */
  events: GitHubEvent[];
  /** Epoch milliseconds when the data was fetched. */
  fetchedAt: number;
  reposTruncated: boolean;
  eventsTruncated: boolean;
}

export type StatKey =
  | 'repos'
  | 'stars'
  | 'followers'
  | 'following'
  | 'languages'
  | 'years';

export interface Stat {
  key: StatKey;
  label: string;
  /** Already formatted for display. */
  value: string;
  hint?: string;
}

export interface LanguageSlice {
  name: string;
  count: number;
  /** Share of analyzed repositories, 0–100. */
  percent: number;
  isOther?: boolean;
}

export interface RepoItem {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  /** ISO timestamp of the last push, or null for an empty repository. */
  pushedAt: string | null;
  archived: boolean;
}

export interface Website {
  href: string;
  label: string;
}

export interface ProfileMeta {
  location: string | null;
  company: string | null;
  website: Website | null;
  /** ISO timestamp. */
  joinedAt: string;
}

export interface Detail {
  label: string;
  /** Already formatted for display. */
  value: string;
  href?: string;
}

export interface ActivityDay {
  /** UTC date key, YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface EventMixItem {
  label: string;
  count: number;
}

export interface ActivityView {
  /** Oldest to newest, exactly windowDays entries. */
  days: ActivityDay[];
  windowDays: number;
  totalEvents: number;
  activeDays: number;
  /** Highest daily event count, used to scale the chart. */
  peakCount: number;
  busiestDay: ActivityDay | null;
  mix: EventMixItem[];
  /** True when the public events list was capped before the full window. */
  truncated: boolean;
}

export interface ProfileView {
  handle: string;
  displayName: string;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  isOrg: boolean;
  meta: ProfileMeta;
  stats: Stat[];
  languages: LanguageSlice[];
  /** Non-fork repositories, sorted by stars descending by default. */
  repos: RepoItem[];
  details: Detail[];
  activity: ActivityView;
  recentActivity: ActivityView;
  notices: string[];
  /** Epoch milliseconds when the data was fetched. */
  fetchedAt: number;
  /** user.public_repos, including forks. */
  repoTotal: number;
  /** Non-fork repositories analyzed. */
  analyzedRepoCount: number;
  /** Forks among the fetched repositories. */
  forkCount: number;
}

export type SortKey = 'stars' | 'recent' | 'name';

export type ApiErrorKind =
  | 'not-found'
  | 'rate-limit'
  | 'network'
  | 'http';

export type ErrorKind = ApiErrorKind | 'invalid';

export interface AppError {
  kind: ErrorKind;
  /** Developer-facing message; the UI maps the kind to human copy. */
  message: string;
  status?: number;
  /** Epoch milliseconds when the rate limit resets. */
  resetAt?: number;
}
