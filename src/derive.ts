import {
  formatDateKey,
  formatNumber,
  formatPercent,
  formatRelative,
  normalizeWebsite,
  pluralize,
} from './format';
import type {
  ActivityDay,
  ActivityView,
  Detail,
  GitHubRepo,
  LanguageSlice,
  ProfileData,
  ProfileView,
  RepoItem,
  SortKey,
  Stat,
} from './types';

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

const EVENT_LABELS: Record<string, string> = {
  PushEvent: 'Pushes',
  PullRequestEvent: 'Pull requests',
  IssuesEvent: 'Issues',
  IssueCommentEvent: 'Issue comments',
  ReleaseEvent: 'Releases',
  WatchEvent: 'Stars given',
  ForkEvent: 'Forks',
  CreateEvent: 'Branches & tags',
  DeleteEvent: 'Deletions',
  PublicEvent: 'Repos made public',
  MemberEvent: 'Members',
  CommitCommentEvent: 'Commit comments',
  GollumEvent: 'Wiki edits',
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sizedAvatar(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('s', '192');
    return parsed.toString();
  } catch {
    return url;
  }
}

function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function yearsSince(iso: string, now: number): number {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (now - time) / YEAR_MS);
}

function timeValue(iso: string | null): number {
  if (!iso) return 0;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

function toRepoItem(repo: GitHubRepo): RepoItem {
  return {
    name: repo.name,
    url: repo.html_url,
    description: clean(repo.description),
    language: clean(repo.language),
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    pushedAt: repo.pushed_at,
    archived: repo.archived,
  };
}

export function sortRepos(repos: RepoItem[], sort: SortKey): RepoItem[] {
  const copy = [...repos];

  if (sort === 'name') {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sort === 'recent') {
    return copy.sort(
      (a, b) =>
        timeValue(b.pushedAt) - timeValue(a.pushedAt) ||
        b.stars - a.stars ||
        a.name.localeCompare(b.name),
    );
  }

  return copy.sort(
    (a, b) => b.stars - a.stars || a.name.localeCompare(b.name),
  );
}

function countLanguages(repos: GitHubRepo[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const repo of repos) {
    const language = clean(repo.language);
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  return counts;
}

function buildLanguageSlices(counts: Map<string, number>): LanguageSlice[] {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  const slices: LanguageSlice[] = sorted
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      count,
      percent: percentOf(count, total),
    }));

  const other = sorted
    .slice(6)
    .reduce((sum, [, count]) => sum + count, 0);

  if (other > 0) {
    slices.push({
      name: 'Other',
      count: other,
      percent: percentOf(other, total),
      isOther: true,
    });
  }

  return slices;
}

function countLicenses(repos: GitHubRepo[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const repo of repos) {
    const license = repo.license;
    if (!license) continue;

    const spdx = license.spdx_id?.trim();
    const key =
      spdx && spdx !== 'NOASSERTION' ? spdx : license.name.trim();

    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function medianRepoAge(repos: GitHubRepo[], now: number): number | null {
  const ages = repos
    .map((repo) => Date.parse(repo.created_at))
    .filter((time) => Number.isFinite(time))
    .map((time) => Math.max(0, (now - time) / YEAR_MS))
    .sort((a, b) => a - b);

  if (ages.length === 0) return null;

  const middle = Math.floor(ages.length / 2);

  return ages.length % 2 === 0
    ? (ages[middle - 1] + ages[middle]) / 2
    : ages[middle];
}

function formatAge(years: number): string {
  if (years < 1) return 'under a year';
  const rounded = Math.round(years * 10) / 10;
  return `${formatNumber(rounded)} ${rounded === 1 ? 'year' : 'years'}`;
}

function buildDetails(
  data: ProfileData,
  repos: GitHubRepo[],
  now: number,
): Detail[] {
  const details: Detail[] = [];
  const latestEvent = data.events[0]?.created_at;

  if (latestEvent) {
    details.push({
      label: 'Last public activity',
      value: formatRelative(latestEvent, now),
    });
  }

  if (repos.length > 0) {
    const licenses = countLicenses(repos);
    const topLicense = [...licenses.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];

    if (topLicense) {
      details.push({
        label: 'Top license',
        value: `${topLicense[0]} · ${pluralize(topLicense[1], 'repo')}`,
      });
    }

    const medianAge = medianRepoAge(repos, now);
    if (medianAge !== null) {
      details.push({
        label: 'Median repo age',
        value: formatAge(medianAge),
      });
    }

    const described = repos.filter(
      (repo) => clean(repo.description) !== null,
    ).length;

    details.push({
      label: 'With a description',
      value: formatPercent((described / repos.length) * 100),
    });
  }

  if (data.user.public_gists > 0) {
    details.push({
      label: 'Public gists',
      value: formatNumber(data.user.public_gists),
    });
  }

  return details;
}

function buildActivity(
  data: ProfileData,
  now: number,
  windowDays: number,
): ActivityView {
  const current = new Date(now);
  const safeNow = Number.isNaN(current.getTime()) ? new Date() : current;
  const endDay = new Date(
    Date.UTC(
      safeNow.getUTCFullYear(),
      safeNow.getUTCMonth(),
      safeNow.getUTCDate(),
    ),
  );
  const startDay = new Date(
    endDay.getTime() - (windowDays - 1) * DAY_MS,
  );
  const startKey = formatDateKey(startDay);
  const endKey = formatDateKey(endDay);

  const counts = new Map<string, number>();
  const eventCounts = new Map<string, number>();

  for (const event of data.events) {
    const time = Date.parse(event.created_at);
    if (!Number.isFinite(time)) continue;

    const key = formatDateKey(new Date(time));
    if (!key || key < startKey || key > endKey) continue;

    counts.set(key, (counts.get(key) ?? 0) + 1);

    const label = EVENT_LABELS[event.type] ?? 'Other';
    eventCounts.set(label, (eventCounts.get(label) ?? 0) + 1);
  }

  const days: ActivityDay[] = [];

  for (let index = 0; index < windowDays; index += 1) {
    const date = new Date(startDay.getTime() + index * DAY_MS);
    const key = formatDateKey(date);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }

  const totalEvents = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;
  const peakCount = days.reduce(
    (max, day) => Math.max(max, day.count),
    0,
  );

  const busiestDay = days.reduce<ActivityDay | null>((best, day) => {
    if (day.count === 0) return best;
    if (!best || day.count >= best.count) return day;
    return best;
  }, null);

  const mix = [...eventCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return {
    days,
    windowDays,
    totalEvents,
    activeDays,
    peakCount,
    busiestDay,
    mix,
    truncated: data.eventsTruncated,
  };
}

export function deriveProfile(
  data: ProfileData,
  now = Date.now(),
): ProfileView {
  const { user } = data;
  const nonForkRepos = data.repos.filter((repo) => !repo.fork);
  const forkCount = data.repos.length - nonForkRepos.length;
  const repoTotal = user.public_repos;

  const totalStars = nonForkRepos.reduce(
    (sum, repo) => sum + repo.stargazers_count,
    0,
  );
  const languageCounts = countLanguages(nonForkRepos);
  const languages = buildLanguageSlices(languageCounts);
  const repos = sortRepos(nonForkRepos.map(toRepoItem), 'stars');
  const details = buildDetails(data, nonForkRepos, now);
  const activity = buildActivity(data, now, 90);
  const recentActivity = buildActivity(data, now, 30);
  const years = yearsSince(user.created_at, now);
  const partialHint = data.reposTruncated
    ? `${formatNumber(nonForkRepos.length)} analyzed`
    : undefined;

  const stats: Stat[] = [
    { key: 'repos', label: 'Public repos', value: formatNumber(repoTotal) },
    {
      key: 'stars',
      label: 'Stars',
      value: formatNumber(totalStars),
      hint: partialHint,
    },
    {
      key: 'followers',
      label: 'Followers',
      value: formatNumber(user.followers),
    },
    {
      key: 'following',
      label: 'Following',
      value: formatNumber(user.following),
    },
    {
      key: 'languages',
      label: 'Languages',
      value: formatNumber(languageCounts.size),
    },
    {
      key: 'years',
      label: 'Years on GitHub',
      value: years < 1 ? '<1' : formatNumber(Math.floor(years)),
    },
  ];

  const notices: string[] = [];

  if (data.reposTruncated) {
    notices.push(
      'Analysis is limited to the 300 most recently pushed public repositories.',
    );
  }

  return {
    handle: user.login,
    displayName: clean(user.name) ?? user.login,
    avatarUrl: sizedAvatar(user.avatar_url),
    profileUrl: user.html_url,
    bio: clean(user.bio),
    isOrg: user.type === 'Organization',
    meta: {
      location: clean(user.location),
      company: clean(user.company),
      website: normalizeWebsite(user.blog),
      joinedAt: user.created_at,
    },
    stats,
    languages,
    repos,
    details,
    activity,
    recentActivity,
    notices,
    fetchedAt: data.fetchedAt,
    repoTotal,
    analyzedRepoCount: nonForkRepos.length,
    forkCount,
  };
}
