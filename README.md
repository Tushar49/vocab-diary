# Vocabulary Diary

A private, offline-first vocabulary journal — installable PWA with SM-2 spaced repetition.
Original clean-room implementation; no third-party app code, assets, or branding.

## Stack

React 19 + Vite + TypeScript · Tailwind v4 · Dexie (IndexedDB, local-only) · vite-plugin-pwa (service worker, offline) · Web Speech API (pronunciation) · Web Push planned (v2) · AI translation is **BYOK** (your key, stored locally, disclosed).

## Run locally (Windows, pnpm)

```powershell
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm build        # production build + service worker into dist/
pnpm icons        # regenerate public/icons (pure-python, no deps)
```

> `pnpm-workspace.yaml` sets `nodeLinker: hoisted` + `packageImportMethod: copy` because the project lives on an exFAT drive (no symlink support). Keep those keys if you move the repo.

## Deploy (free, permanent — no Apple account needed)

1. Push this repo to GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` — `.github/workflows/deploy-pages.yml` builds and publishes.
4. On the iPhone: open the URL in Safari → Share → **Add to Home Screen**. Runs standalone, offline, forever; no re-signing cycle ever.

`vite.config.ts` uses `base: "./"` so it works from any subpath (including `user.github.io/<repo>/`).

## Install on iPhone (the "no weekly re-verification" path)

GitHub Pages hosting is permanent. Safari's 7-day storage eviction does **not** apply to Home-Screen web apps, and the app additionally calls `navigator.storage.persist()`. Keep the one-tap JSON backup (Settings → Data) as the belt-and-braces safety net.

## Layout

```
src/
  core/      pure logic: sm2, xp, grades, search, parsers, date (+ vitest suites)
  db/        Dexie schema + repositories (words, reviews, daily stats, settings)
  i18n/      centralised strings (en v1, add locales beside strings.ts)
  platform/  speech (TTS), deep links, storage
  study/     session engine (mode selection, ordering)
  ui/        components + screens (Library, AddEdit, WordDetail, Study, Progress, Settings, Translate, Import, Onboarding)
scripts/     gen_icons.py — original geometric icon, pure stdlib
.github/     CI + GitHub Pages deploy workflows
```

## Deliberate limits

- Photo OCR (F-07): pending optional dependency (Tesseract.js + local traineddata) — not downloaded by default.
- Web Push word-of-the-day (F-26 v2): needs the Vercel/serverless function; UI + settings shipped.
- Native widgets / Share Extension / App Intents: impossible for web apps; replaced by deep links (`#/?add=word=…`, `#/add?text=…`) + a shipped iOS Shortcut recipe.
