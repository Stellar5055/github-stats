# GitHub Stats

[![CI](https://github.com/Stellar5055/github-stats/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar5055/github-stats/actions/workflows/ci.yml)
[![Deploy](https://github.com/Stellar5055/github-stats/actions/workflows/deploy.yml/badge.svg)](https://github.com/Stellar5055/github-stats/actions/workflows/deploy.yml)

**Live:** [stellar5055.github.io/github-stats](https://stellar5055.github.io/github-stats/)  
**Repo:** [github.com/Stellar5055/github-stats](https://github.com/Stellar5055/github-stats)

A small, printable GitHub profile stats page. Enter a handle, profile URL, or repository URL and get a clean single page with the profile, headline numbers, languages, repositories, and recent public activity.

Working name: **GitHub Stats**. Built as a small project for Hack Club Crossroads.

## What it does

- Look up any public GitHub user by handle, `@handle`, profile URL, or repository URL.
- Shows public repos, stars, followers, following, languages, and account age.
- Breaks down the language mix by primary language.
- Lists repositories with descriptions, languages, stars, and last push. Sort by stars, recency, or name.
- Adds details: join date, location, company, website, most starred repo, top license, median repo age, description rate, and public gists.
- Draws 30 or 90 days of public activity and an event mix.
- Follows the system light/dark preference and remembers a manual theme choice.
- Includes a print stylesheet for a clean printed record (usually one or two pages). The printed page always uses the light palette.
- Caches successful lookups locally for 15 minutes and falls back to the last saved profile when GitHub is unreachable.

## Stack

- Vite + TypeScript, no UI framework
- Hand-written CSS
- GitHub REST API (unauthenticated)
- GitHub Pages via GitHub Actions

The landing page and method page are static HTML, with a small theme script. The only JavaScript-driven data view is `?u=<handle>`.

## Commands

```bash
npm install
npm run dev
npm run test
npm run build
npm run preview
```

## Structure

```text
index.html              static landing page + native search form
src/main.ts             boot from ?u=, cache, fetch, render, interactions
src/api.ts              GitHub requests, pagination, typed errors
src/cache.ts            15-minute localStorage cache + stale fallback
src/parse.ts            handle / profile URL / repo URL parsing
src/types.ts            API and view-model types
src/derive.ts           raw API data -> stats, languages, details, activity
src/format.ts           escaping, numbers, dates, relative time, URLs
src/render.ts           profile, loading, error, section templates
src/theme.ts            theme resolution, persistence, header toggle
src/method.ts           theme boot for the static method page
src/styles.css          tokens, landing, profile, responsive, print
tests/                  pure-function tests with fixtures
```

## Data rules

- Public GitHub data only.
- Forks are excluded from totals and counted separately.
- Up to 300 repositories and 300 public events are analyzed. The page says when it is working from a capped set.
- Unauthenticated GitHub API requests are limited to 60/hour per IP. Successful lookups are cached for 15 minutes.
- No accounts, backend, database, or API tokens.
- Not affiliated with GitHub.

## Deploy

The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to `main` or `master`.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to your default branch.

`vite.config.ts` uses `base: './'`, so the site works under any repository path without extra configuration.

## License

MIT. See [LICENSE](LICENSE).
