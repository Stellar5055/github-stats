import { describe, expect, it } from 'vitest';

import { deriveProfile, sortRepos } from '../src/derive';
import {
  makeEvent,
  makeProfileData,
  makeRepo,
  makeUser,
} from './fixtures';

const NOW = Date.parse('2026-11-12T12:00:00Z');

describe('deriveProfile', () => {
  it('excludes forks from totals and reports them', () => {
    const data = makeProfileData({
      user: makeUser({ public_repos: 3 }),
      repos: [
        makeRepo({ name: 'alpha', stargazers_count: 10 }),
        makeRepo({ name: 'beta', stargazers_count: 20 }),
        makeRepo({ name: 'forked', fork: true, stargazers_count: 1000 }),
      ],
    });

    const view = deriveProfile(data, NOW);

    expect(view.stats.find((stat) => stat.key === 'stars')?.value).toBe('30');
    expect(view.repoTotal).toBe(3);
    expect(view.analyzedRepoCount).toBe(2);
    expect(view.forkCount).toBe(1);
  });

  it('builds language slices by repository count', () => {
    const data = makeProfileData({
      user: makeUser({ public_repos: 5 }),
      repos: [
        makeRepo({ name: 'a', language: 'TypeScript' }),
        makeRepo({ name: 'b', language: 'TypeScript' }),
        makeRepo({ name: 'c', language: 'TypeScript' }),
        makeRepo({ name: 'd', language: 'Go' }),
        makeRepo({ name: 'e', language: 'Rust' }),
      ],
    });

    const view = deriveProfile(data, NOW);

    expect(view.languages).toEqual([
      { name: 'TypeScript', count: 3, percent: 60 },
      { name: 'Go', count: 1, percent: 20 },
      { name: 'Rust', count: 1, percent: 20 },
    ]);
    expect(view.stats.find((stat) => stat.key === 'languages')?.value).toBe(
      '3',
    );
  });

  it('builds details without repeating identity fields', () => {
    const data = makeProfileData({
      user: makeUser({
        public_repos: 3,
        public_gists: 2,
        location: 'Berlin',
        company: '@github',
        blog: 'https://example.com',
      }),
      repos: [
        makeRepo({
          name: 'one',
          description: 'Yes',
          license: {
            key: 'mit',
            name: 'MIT License',
            spdx_id: 'MIT',
            url: null,
          },
        }),
        makeRepo({
          name: 'two',
          description: 'Second',
          license: {
            key: 'mit',
            name: 'MIT License',
            spdx_id: 'MIT',
            url: null,
          },
        }),
        makeRepo({
          name: 'three',
          description: '',
          license: {
            key: 'apache-2.0',
            name: 'Apache License 2.0',
            spdx_id: 'Apache-2.0',
            url: null,
          },
        }),
      ],
    });

    const view = deriveProfile(data, NOW);
    const labels = view.details.map((detail) => detail.label);

    expect(labels).toEqual([
      'Last public activity',
      'Top license',
      'Median repo age',
      'With a description',
      'Public gists',
    ]);
    expect(view.meta.location).toBe('Berlin');
    expect(view.meta.company).toBe('@github');
    expect(view.meta.website?.href).toBe('https://example.com/');
    expect(
      view.details.find((detail) => detail.label === 'Top license')?.value,
    ).toBe('MIT · 2 repos');
    expect(
      view.details.find((detail) => detail.label === 'With a description')
        ?.value,
    ).toBe('67%');
  });

  it('builds a 90-day activity window in UTC', () => {
    const data = makeProfileData({
      events: [
        makeEvent({
          type: 'PushEvent',
          created_at: '2026-11-12T08:00:00Z',
        }),
        makeEvent({
          type: 'PushEvent',
          created_at: '2026-11-11T23:00:00Z',
        }),
        makeEvent({
          type: 'PullRequestEvent',
          created_at: '2026-10-13T12:00:00Z',
        }),
        makeEvent({
          type: 'IssuesEvent',
          created_at: '2026-08-01T12:00:00Z',
        }),
        makeEvent({
          type: 'PushEvent',
          created_at: 'not-a-date',
        }),
      ],
    });

    const view = deriveProfile(data, NOW);

    expect(view.activity.days).toHaveLength(90);
    expect(view.activity.days.at(-1)?.date).toBe('2026-11-12');
    expect(view.activity.totalEvents).toBe(3);
    expect(view.recentActivity.days).toHaveLength(30);
    expect(view.recentActivity.totalEvents).toBe(2);
    expect(view.activity.activeDays).toBe(3);
    expect(view.activity.peakCount).toBe(1);
    expect(view.activity.busiestDay?.date).toBe('2026-11-12');
    expect(view.activity.mix).toEqual([
      { label: 'Pushes', count: 2 },
      { label: 'Pull requests', count: 1 },
    ]);
  });

  it('handles a profile with no repositories', () => {
    const data = makeProfileData({
      user: makeUser({
        public_repos: 0,
        public_gists: 0,
        location: null,
        company: null,
        blog: null,
      }),
      repos: [],
      events: [],
    });

    const view = deriveProfile(data, NOW);

    expect(view.repos).toEqual([]);
    expect(view.languages).toEqual([]);
    expect(view.stats.find((stat) => stat.key === 'stars')?.value).toBe('0');
    expect(view.details).toEqual([]);
    expect(view.activity.totalEvents).toBe(0);
    expect(view.activity.busiestDay).toBeNull();
    expect(view.activity.mix).toEqual([]);
  });

  it('handles a profile with only forked repositories', () => {
    const data = makeProfileData({
      user: makeUser({ public_repos: 2 }),
      repos: [
        makeRepo({ name: 'fork-a', fork: true }),
        makeRepo({ name: 'fork-b', fork: true }),
      ],
    });

    const view = deriveProfile(data, NOW);

    expect(view.analyzedRepoCount).toBe(0);
    expect(view.forkCount).toBe(2);
    expect(view.notices).toEqual([]);
  });

  it('adds truncation notices', () => {
    const data = makeProfileData({
      user: makeUser({ public_repos: 500 }),
      reposTruncated: true,
      eventsTruncated: true,
    });

    const view = deriveProfile(data, NOW);

    expect(view.notices).toHaveLength(1);
    expect(view.notices.join(' ')).toContain('300');
    expect(
      view.stats.find((stat) => stat.key === 'stars')?.hint,
    ).toBe('1 analyzed');
    expect(
      view.stats.find((stat) => stat.key === 'languages')?.hint,
    ).toBeUndefined();
  });

  it('sorts repositories by stars, recency, and name', () => {
    const data = makeProfileData({
      user: makeUser({ public_repos: 3 }),
      repos: [
        makeRepo({
          name: 'old',
          stargazers_count: 5,
          pushed_at: '2020-01-01T00:00:00Z',
        }),
        makeRepo({
          name: 'new',
          stargazers_count: 1,
          pushed_at: '2026-11-01T00:00:00Z',
        }),
        makeRepo({
          name: 'mid',
          stargazers_count: 10,
          pushed_at: '2024-01-01T00:00:00Z',
        }),
      ],
    });

    const view = deriveProfile(data, NOW);

    expect(sortRepos(view.repos, 'stars').map((repo) => repo.name)).toEqual([
      'mid',
      'old',
      'new',
    ]);
    expect(sortRepos(view.repos, 'recent').map((repo) => repo.name)).toEqual([
      'new',
      'mid',
      'old',
    ]);
    expect(sortRepos(view.repos, 'name').map((repo) => repo.name)).toEqual([
      'mid',
      'new',
      'old',
    ]);
  });
});
