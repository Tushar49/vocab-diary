# AGENTS.md — guidance for AI coding agents working in this repo

## Ground rules
- Package manager: **pnpm only**. Never run `npm`, `npx`, or `yarn`. Minimal new dependencies — prefer pnpm packages over network downloads; nothing should fetch assets at runtime that wasn't committed.
- This project lives on an exFAT drive: `pnpm-workspace.yaml` pins `nodeLinker: hoisted` + `packageImportMethod: copy`, and esbuild builds were approved via `pnpm approve-builds --all`. Do not remove these.

## Verify before you claim done
Run all three gates and keep them green:
```powershell
pnpm typecheck   # tsc --noEmit, 0 errors
pnpm test        # vitest run, all suites pass
pnpm build       # vite build + service worker precache
```

## Conventions
- i18n: `src/i18n/strings.ts` is **append-only** — never reorder, rename, or delete keys; add new keys at the end.
- Architecture: layer boundaries are `core/` (pure logic, tested) → `db/` (Dexie repositories) → `ui/` (screens); UI code must stay free of direct Dexie calls.
- Export/import formats live in `src/core/parsers.ts`; PDF export layout constants in `src/core/pdf.ts` and its parser in `src/core/pdfImport.ts` must stay in sync (font sizes are the contract). Add round-trip tests for any format change.
- JSON export/import is the fidelity path (SM-2 state, streaks, ids); CSV/Markdown/TXT are lossy by design — don't add scheduling fields to them.
- No comments unless strictly needed; TypeScript strict mode is on.

## Project files
- Icons: `pnpm icons` runs `scripts/gen_icons.py` (stdlib-only Python). Fonts for the PDF path come from committed TTFs; regenerate with `node scripts/convert-fonts.mjs`.
- Tasks needing context: see the "Deliberate limits" section in README.md before proposing features like photo OCR or Web Push.
