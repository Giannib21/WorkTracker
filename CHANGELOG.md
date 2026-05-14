# Changelog

All notable changes to **WorkTracker** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on 1.0.0:** This repository’s first tagged `package.json` version is **1.1.1**. There is no Git history for `1.0.0`; treat it as a pre-repository or external baseline if needed for your internal records.

## [Unreleased]

## [2.0.0] — 2026-05-14

### Added

- `npm run aci:print-vercel-env` — prints `ACI_SESSION_JSON` (single line) and optional Keycloak JWT for Vercel; optional `--write-one-line` writes `scripts/aci/aci-session.one-line.json` (gitignored).
- `npm run aci:vercel-env-add-session` — `scripts/aci/vercel-env-add-from-file.mjs` pipes session JSON into `vercel env add` (works on **PowerShell**, where `< file` redirection is invalid).

### Changed

- Bump app and package version to **2.0.0** (`package.json`, `package-lock.json`, `app.json`, `utils/appVersion.ts`).
- Profile / ACI wizard: tighter UX (e.g. removal of obsolete “Phase 2” hint on Profile, smaller personal-use disclaimer text, layout and copy aligned with current proxy flow).

## [1.1.3] — 2026-05-13

### Added

- **ACI Costi km (proxy + app):** Vercel `api/aci-proxy.mjs` for catalog and cost flows; cookie forwarding helpers; `utils/aciCostikmClient.ts` and timestamps.
- **Session tooling:** `npm run aci:capture` (Playwright), `scripts/aci/*` (session types, storage dump, wait-for-login, `AciCostiService`, cookies, errors).
- **Profile wizard:** `AciCostikmProfileSection` — brand/fuel/model pickers, cost request via `EXPO_PUBLIC_ACI_PROXY_URL`, official calculator link, VAT net switch, annual km and €/km band handling.
- **`utils/aciCostikmCostsParse.ts`:** parsing of cost responses and `totalcosts_km`–style `{ label, value }` bands; suggestions by annual km.
- **i18n:** strings for the ACI wizard (IT/EN).

### Changed

- Proxy and client iterated across multiple commits (session snapshot loading, `/costs`, captcha-related paths, error handling, Keycloak JWT hints).

### Fixed

- PDF export: printing layout and attachment sizing (follow-up **v2** in this release).

## [1.1.2] — 2026-05-13

### Fixed

- Export / icon metadata alignment (`app.json` and version files).
- Multi-user behaviour (`app/_layout.tsx`, `db/database.ts`) and Vercel config (`vercel.json`).
- PDF letter: printing size and attachment handling (`utils/pdf.native.ts`, `utils/pdf.web.ts`).

## [1.1.1] — 2026-05-13

### Added

- Initial **WorkTracker** application: Expo Router app (home, expenses, settings, profile, day editor, expense editor, export).
- Local **SQLite** persistence, Italian/English **i18n**, company-locked profile fields, mileage and expense workflows.
- **PDF** and **Excel** export (native + web), expense attachments, calendar and holidays utilities.
- Web layout helpers (desktop rail, SQLite web guard), ESLint, Metro, `vercel.json`, capoluoghi festivity generator script.
