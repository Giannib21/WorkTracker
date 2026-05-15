# Changelog

All notable changes to **WorkTracker** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on 1.0.0:** This repository’s first tagged `package.json` version is **1.1.1**. There is no Git history for `1.0.0`; treat it as a pre-repository or external baseline if needed for your internal records.

## [Unreleased]

## [2.3.0] — 2026-05-15

### Added

- **Impostazioni — Backup e ripristino (livello 1):** export di presenze, spese, impostazioni/profilo e **allegati completi** in un file `.wtbackup` (JSON); condivisione tramite menu di sistema (OneDrive, Drive, iCloud, email, ecc.); ripristino da file con conferma e sostituzione dei dati locali. Moduli `utils/backupRestore.ts`, `utils/backupRestoreIO.ts`; funzioni DB `listAllGiorni`, `listAllSpese`, `replaceAllDataFromBackup`. Stringhe i18n IT/EN; nota privacy aggiornata.

### Changed

- Versione app e pacchetto portate a **2.3.0** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).
- **Web — allegati:** nuovi file e foto salvati in **IndexedDB** con riferimento corto `wt-att:` in SQLite (invece di data URL giganti nel DB); `utils/webAttachmentStore.ts`, hook `hooks/useAttachmentPreviewUri.ts`; `persistPickedFile` su web allineato allo stesso modello.

### Fixed

- **Ripristino backup — iOS/Android:** scrittura allegati con `downloadAsync` / `encoding: 'base64'`, estensione da MIME, normalizzazione URI `file://` per l’anteprima; conversione **HEIC → JPEG** al ripristino.
- **Ripristino backup — web (PC):** allegati ripristinati in IndexedDB e anteprima risolta via blob URL; conversione HEIC → JPEG per compatibilità con Chrome; export PDF su web che legge i riferimenti `wt-att:`.

## [2.2.5] — 2026-05-15

### Added

- **`npm run aci:capture-push`:** dopo login CIE/SPID in Chromium, un solo INVIO salva la sessione, aggiorna su Vercel **`ACI_SESSION_JSON`** e **`ACI_COSTIKM_KEYCLOAK_TOKEN`** (se il JWT è nello snapshot), poi **`vercel redeploy`** sull’ultimo deployment per ogni ambiente in `--vercel-env` (default: `production`). Opzioni: `--no-vercel-redeploy`, `--vercel-redeploy-no-wait`. Richiede `vercel link` e `vercel login` nella root del repo.
- Moduli condivisi **`scripts/aci/session-vercel.ts`** (estrazione JWT Keycloak) e **`scripts/aci/vercelEnvCli.ts`** (push variabili e redeploy via CLI Vercel).

### Changed

- Versione app e pacchetto portate a **2.2.5** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).
- **GPS — etichetta posizione:** da coordinate si mostra solo **comune** (o equivalente) e **provincia / area amministrativa**, senza via né CAP; su web Nominatim usa `county` per la provincia in Italia (`utils/locationHumanLabel.ts`).
- Script ACI: logica JWT e push Vercel centralizzati; messaggi aggiornati in `capture-session`, `print-vercel-env`, `session-manager` e `vercel-env-add-from-file`.

## [2.2.4] — 2026-05-14

### Changed

- Versione app e pacchetto portate a **2.2.4** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).

### Fixed

- **Web / PWA:** pulsante **GPS** su **giornata** e **spesa** inseriva solo le **coordinate** perché `expo-location` non supporta il reverse geocoding nel browser. Ora, su web, si usa un fallback (**OpenStreetMap Nominatim**) per ottenere un **indirizzo leggibile**; su iOS/Android resta il geocoding nativo, con formattazione più ricca (via, CAP, ecc.) quando disponibili (`utils/locationHumanLabel.ts`).

## [2.2.3] — 2026-05-14

### Changed

- Versione app e pacchetto portate a **2.2.3** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).
- **Profilo — Auto / rimborso km e ACI:** sezione ACI **accorpata** nella stessa card; in modalità **Automatico** il pulsante **«Apri calcolo ufficiale ACI»** è **nascosto** finché non c’è un **errore** nel wizard (in quel caso ricompare per consultare il calcolo ufficiale).
- **Profilo — ACI:** countdown prima del recupero costo da **90** a **75** secondi.

## [2.2.2] — 2026-05-14

### Added

- **Spesa — rimborso km:** toggle **«Auto salvata»** sotto il campo Km: se attivo (e il Profilo ha modello + €/km), **€/km** e **modello auto** sono precompilati dal profilo e non editabili; se disattivo sono liberi. In **nuova spesa**, con profilo completo il toggle va **on** scegliendo la categoria km; in **modifica** va **on** solo se i valori salvati coincidono con il profilo. `useFocusEffect` aggiorna i dati profilo al ritorno sulla schermata.

### Changed

- Versione app e pacchetto portate a **2.2.2** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).
- **i18n IT:** titolo scheda **`Nuova Spesa`** (`expNewTitle`) e pulsante elenco **`+ Nuova Spesa`** (`listSpeseNuova`).

## [2.2.1] — 2026-05-14

### Changed

- Versione app e pacchetto portate a **2.2.1** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).
- **`HapticButton` / `HapticIconButton`:** feedback aptico anche su `onPress` (con deduplicazione su `onPressIn` / `onPressOut`) così il Taptic parte anche se `onPressIn` non scatta su alcuni percorsi.
- **`utils/haptics.ts`:** nessun log di diagnostica; `impactAsync` con stile **Medium**.

### Fixed

- **Web PWA (iPhone, app installata da home):** tab bar distanziata dal bordo inferiore in modalità standalone (`utils/webStandaloneDisplay.ts`, padding con `env(safe-area-inset-bottom)`); `WebPwaBootstrap` aggiunge **`viewport-fit=cover`** al meta viewport così le safe area iOS sono disponibili.

## [2.1.0] — 2026-05-14

### Added

- **Haptics (iOS / Android):** `expo-haptics`, `utils/haptics.ts`, `HapticButton` / `HapticIconButton` (con `forwardRef` per `Link asChild`); feedback più marcato sui pulsanti e `selectionAsync` su tab, giorni calendario, liste, switch, wizard ACI, tastiera numerica «Fatto», FAB Export.
- **Web PWA:** `public/manifest.json`, icone `pwa-192.png` / `pwa-512.png`, `public/sw.js` (pass-through, niente cache aggressiva), `WebPwaBootstrap` che inietta meta/manifest e registra lo SW solo fuori da dev/tunnel; niente `public/index.html` custom (evita pagina bianca con SSR Metro).
- **Export web — email PDF:** dopo la generazione del PDF, dialog con «Condividi PDF» (Web Share API), «Apri email» (`mailto` con oggetto/corpo) e «Scarica PDF»; nuove stringhe i18n IT/EN.

### Changed

- Versione app e pacchetto portate a **2.1.0** (`package.json`, `package-lock.json`, `app.json`, fallback in `utils/appVersion.ts`).
- **Profilo:** modalità **Manuale / Automatico** per modello auto e €/km (salvata in `profilo_car_cost_mode`); in automatico i campi sono disabilitati e compare solo la sezione ACI; pulsante calcolatore ufficiale sotto €/km con hint decimali.
- **ACI:** countdown **90s** sul pulsante «Richiedi dati costo» durante l’attesa; testi UI snelliti (intro, titolo proxy, helper km annui).
- **Tooling:** `eslint.config.js` — global Node per `api/` e `scripts/`; `metro.config.js` — `@ts-nocheck` per tipi Metro readonly.

### Removed

- Dipendenza **vexo-analytics** (non usata); `utils/getAsyncResponse.js` e `utils/cookieHeaderFromSetCookieLines.js` (non referenziati); chiavi i18n ACI non usate (`aciWizardSuggestedBandLine`, `aciWizardApplySuggestedBand`).

### Fixed

- **Web:** schermata bianca in dev legata al template `public/index.html` personalizzato; SW non registrato su localhost/LAN/tunnel Expo.
- **Export web mobile:** `mailto` dopo `await` non partiva (popup bloccato); flusso sostituito dal dialog sopra.

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
