const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const RESERVED = new Set([
  'about',
  'account',
  'apps',
  'blog',
  'business',
  'collections',
  'contact',
  'customer-stories',
  'dashboard',
  'developer',
  'developers',
  'explore',
  'features',
  'gist',
  'git',
  'help',
  'home',
  'issues',
  'join',
  'login',
  'marketplace',
  'new',
  'notifications',
  'organizations',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'security',
  'settings',
  'showcases',
  'site',
  'sponsors',
  'stars',
  'topics',
  'trending',
  'users',
  'watching',
]);

const URL_LIKE = /^(https?:\/\/|\/\/|(?:www\.)?github\.com(?:\/|$))/i;

export interface ParseSuccess {
  ok: true;
  handle: string;
}

export interface ParseFailure {
  ok: false;
  reason: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

function failure(reason: string): ParseFailure {
  return { ok: false, reason };
}

export function parseHandle(raw: string): ParseResult {
  let value = raw.trim();
  if (!value) {
    return failure('Enter a GitHub username, profile URL, or repository URL.');
  }

  if (value.startsWith('@')) value = value.slice(1).trim();
  if (!value) {
    return failure('Enter a GitHub username, profile URL, or repository URL.');
  }

  let candidate = '';

  if (URL_LIKE.test(value)) {
    const withProtocol = value.startsWith('//')
      ? `https:${value}`
      : /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`;

    let url: URL;
    try {
      url = new URL(withProtocol);
    } catch {
      return failure('That doesn’t look like a GitHub username or link.');
    }

    const host = url.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return failure('Use a GitHub profile or repository URL.');
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0]?.toLowerCase() === 'orgs') segments.shift();
    candidate = segments[0] ?? '';
  } else {
    const withoutQuery = value.split(/[?#]/, 1)[0] ?? '';
    const [first] = withoutQuery.split('/');
    candidate = first ?? '';

    if (candidate.includes('.')) {
      return failure('Use a GitHub profile or repository URL.');
    }
  }

  candidate = candidate.trim();
  if (!candidate) {
    return failure('Add a username or repository to the GitHub URL.');
  }
  if (RESERVED.has(candidate.toLowerCase())) {
    return failure('That GitHub path isn’t a profile or repository.');
  }
  if (!USERNAME_RE.test(candidate)) {
    return failure('That doesn’t look like a GitHub username.');
  }

  return { ok: true, handle: candidate.toLowerCase() };
}
