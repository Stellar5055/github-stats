import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGIN?.trim() ||
  'http://localhost:5173,http://127.0.0.1:4173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE = 200;
const cache = new Map();

const QUERY = `query($login: String!) {
  viewer {
    login
  }
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

function cors(origin) {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    Vary: 'Origin',
  };
}

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function pruneCache() {
  if (cache.size <= MAX_CACHE) return;

  const oldest = [...cache.entries()].sort(
    (a, b) => a[1].at - b[1].at,
  )[0];

  if (oldest) cache.delete(oldest[0]);
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const headers = cors(origin);
  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' }, headers);
    return;
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true }, headers);
    return;
  }

  if (url.pathname !== '/contributions') {
    sendJson(res, 404, { error: 'Not found.' }, headers);
    return;
  }

  if (!TOKEN) {
    sendJson(
      res,
      500,
      { error: 'GITHUB_TOKEN is not configured.' },
      headers,
    );
    return;
  }

  const login = url.searchParams.get('login')?.trim() ?? '';
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) {
    sendJson(res, 400, { error: 'Invalid GitHub login.' }, headers);
    return;
  }

  const key = login.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    sendJson(res, 200, cached.data, {
      ...headers,
      'Cache-Control': 'public, max-age=900',
    });
    return;
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'github-stats-contrib-proxy',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { login },
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      sendJson(
        res,
        502,
        { error: 'GitHub GraphQL request failed.' },
        headers,
      );
      return;
    }

    if (payload?.errors?.length) {
      sendJson(res, 502, { error: 'GitHub GraphQL error.' }, headers);
      return;
    }

    const viewer = payload?.data?.viewer?.login;
    if (
      viewer &&
      viewer.toLowerCase() === login.toLowerCase()
    ) {
      sendJson(
        res,
        403,
        { error: 'Contribution data is private for this account.' },
        headers,
      );
      return;
    }

    const user = payload?.data?.user;
    if (!user) {
      sendJson(res, 404, { error: 'User not found.' }, headers);
      return;
    }

    const calendar =
      user.contributionsCollection?.contributionCalendar;

    if (!calendar) {
      sendJson(
        res,
        502,
        { error: 'Contribution calendar unavailable.' },
        headers,
      );
      return;
    }

    const data = {
      viewer: payload.data.viewer?.login,
      total: calendar.totalContributions,
      weeks: calendar.weeks.map((week) => ({
        days: week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
        })),
      })),
    };

    cache.set(key, { at: Date.now(), data });
    pruneCache();

    sendJson(res, 200, data, {
      ...headers,
      'Cache-Control': 'public, max-age=900',
    });
  } catch {
    sendJson(res, 502, { error: 'Could not reach GitHub.' }, headers);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GitHub Stats contribution proxy listening on ${PORT}`);
});
