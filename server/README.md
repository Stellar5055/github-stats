# Contribution proxy

This is an optional Node service that adds a real 12-month GitHub contribution calendar to the site.

The static site works without it. The contributions section stays hidden unless `VITE_CONTRIB_PROXY_URL` is set at build time.

## Why a proxy?

GitHub GraphQL requires an authenticated token. The token must never be shipped to the browser, so this small server holds it and exposes one fixed query:

`GET /contributions?login=<handle>`

It validates the login, caches responses for 15 minutes, and only returns contribution calendar data. It is not a general-purpose GraphQL proxy.

## Token

Use a token from a **dedicated account** with no access to private repositories. Do not use your personal token if you plan to publish the proxy, because a token can expose private contribution counts for its own account.

The proxy refuses to return contribution data for the token owner's profile, so private contribution counts cannot leak through the endpoint. The frontend also hides the section for that account.

Never commit the token.

## Run locally

```bash
# PowerShell
$env:GITHUB_TOKEN = (gh auth token)
$env:ALLOWED_ORIGIN = "http://127.0.0.1:4173"
npm --prefix server start
```

Then build/serve the frontend with the proxy URL:

```bash
$env:VITE_CONTRIB_PROXY_URL = "http://127.0.0.1:8787"
npm run dev
```

For production, set `ALLOWED_ORIGIN` to the exact Pages origin:

```text
https://stellar5055.github.io
```

Multiple origins can be comma-separated.

## Deploy to Render

The repository includes `render.yaml`:

1. Create a Render Blueprint from the repository.
2. Set the `GITHUB_TOKEN` secret.
3. Keep `ALLOWED_ORIGIN` set to `https://stellar5055.github.io`.
4. Copy the service URL.
5. In GitHub, add an Actions repository variable named `VITE_CONTRIB_PROXY_URL` with that URL.
6. Re-run the Pages deploy workflow.

Without step 5, the site continues to work and simply hides the contributions section.

## Endpoints

- `GET /health` — health check
- `GET /contributions?login=torvalds` — contribution calendar JSON
