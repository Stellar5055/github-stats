import { describe, expect, it } from 'vitest';

import { parseHandle } from '../src/parse';

function expectHandle(input: string, handle: string): void {
  expect(parseHandle(input)).toEqual({ ok: true, handle });
}

function expectFailure(input: string, reasonPart?: string): void {
  const result = parseHandle(input);
  expect(result.ok).toBe(false);

  if (!result.ok && reasonPart) {
    expect(result.reason).toContain(reasonPart);
  }
}

describe('parseHandle', () => {
  it('accepts plain handles and @handles', () => {
    expectHandle('torvalds', 'torvalds');
    expectHandle('  @Torvalds  ', 'torvalds');
    expectHandle('foo-bar', 'foo-bar');
    expectHandle('a1-b2', 'a1-b2');
    expectHandle('123', '123');
    expectHandle('github', 'github');
  });

  it('accepts profile URLs', () => {
    expectHandle('https://github.com/sindresorhus', 'sindresorhus');
    expectHandle('https://github.com/github', 'github');
    expectHandle('github.com/sindresorhus/', 'sindresorhus');
    expectHandle('www.github.com/foo?tab=repositories', 'foo');
    expectHandle('//github.com/foo', 'foo');
    expectHandle('HTTPS://GITHUB.COM/FOO', 'foo');
    expectHandle('https://github.com/foo#readme', 'foo');
  });

  it('accepts repository and organization URLs', () => {
    expectHandle('https://github.com/foo/bar', 'foo');
    expectHandle('https://github.com/foo/bar/issues', 'foo');
    expectHandle('https://github.com/orgs/hackclub', 'hackclub');
    expectHandle('https://github.com/orgs/hackclub/people', 'hackclub');
    expectHandle('github.com/orgs/hackclub', 'hackclub');
  });

  it('accepts bare path fragments', () => {
    expectHandle('foo/bar', 'foo');
    expectHandle('@foo/bar', 'foo');
    expectHandle('foo?tab=repositories', 'foo');
    expectHandle('foo#readme', 'foo');
  });

  it('rejects empty and malformed input', () => {
    expectFailure('', 'username');
    expectFailure('   ', 'username');
    expectFailure('@', 'username');
    expectFailure('foo bar', 'GitHub username');
    expectFailure('foo_bar', 'GitHub username');
    expectFailure('-foo', 'GitHub username');
    expectFailure('foo-', 'GitHub username');
    expectFailure('foo--bar', 'GitHub username');
    expectFailure('a'.repeat(40), 'GitHub username');
  });

  it('rejects non-GitHub and reserved paths', () => {
    expectFailure('https://gitlab.com/foo', 'GitHub profile link');
    expectFailure('gitlab.com/foo', 'GitHub profile link');
    expectFailure('https://example.com/foo', 'GitHub profile link');
    expectFailure('https://github.com/settings/profile', 'profile');
    expectFailure('https://github.com/features', 'profile');
    expectFailure('https://github.com/orgs', 'username');
    expectFailure('https://github.com/', 'username');
    expectFailure('github.com', 'username');
  });
});
