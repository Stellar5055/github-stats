import type {
  GitHubEvent,
  GitHubRepo,
  GitHubUser,
  ProfileData,
} from '../src/types';

let nextEventId = 1;

export function makeUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  return {
    login: 'octocat',
    id: 1,
    avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    html_url: 'https://github.com/octocat',
    type: 'User',
    name: 'The Octocat',
    company: '@github',
    blog: 'https://github.blog',
    location: 'San Francisco',
    bio: 'A friendly cat.',
    public_repos: 1,
    public_gists: 0,
    followers: 120,
    following: 12,
    created_at: '2011-01-25T18:44:36Z',
    ...overrides,
  };
}

export function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: 'hello-world',
    html_url: 'https://github.com/octocat/hello-world',
    description: 'A demo repository',
    fork: false,
    archived: false,
    language: 'TypeScript',
    stargazers_count: 10,
    forks_count: 2,
    license: {
      key: 'mit',
      name: 'MIT License',
      spdx_id: 'MIT',
      url: null,
    },
    created_at: '2020-01-01T00:00:00Z',
    pushed_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<GitHubEvent> = {}): GitHubEvent {
  const id = String(nextEventId);
  nextEventId += 1;

  return {
    id,
    type: 'PushEvent',
    created_at: '2026-11-10T12:00:00Z',
    repo: {
      id: 1,
      name: 'octocat/hello-world',
      url: 'https://api.github.com/repos/octocat/hello-world',
    },
    ...overrides,
  };
}

export function makeProfileData(
  overrides: Partial<ProfileData> = {},
): ProfileData {
  return {
    user: makeUser(),
    repos: [makeRepo()],
    events: [makeEvent()],
    fetchedAt: Date.parse('2026-11-12T12:00:00Z'),
    reposTruncated: false,
    eventsTruncated: false,
    ...overrides,
  };
}
