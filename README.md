# WorkTracker

App **Expo / React Native** per registrare **presenze** e **spese di trasferta**, con export (PDF, Excel), allegati alle ricevute e backup manuale. Disponibile su **iOS**, **Android** e **web** (PWA statica).

Versione corrente: **2.3.3** — vedi [CHANGELOG.md](./CHANGELOG.md) per il dettaglio delle release.

## Funzionalità principali

- **Calendario presenze** — giornate lavorative, sedi, note.
- **Spese** — categorie, importi, allegati (foto/PDF); anteprima su tutte le piattaforme.
- **Profilo e impostazioni** — dati aziendali, lingue IT/EN, export periodici.
- **Export** — report PDF e Excel editabile (fogli Nota spese, Rimborsi km e Presenze con logo e impostazioni stampa A4).
- **Backup e ripristino** — file `.wtbackup` (JSON) con dati SQLite e allegati; conlabello tramite menu di sistema (OneDrive, Drive, email, ecc.) da **Impostazioni**. Il ripristino **sostituisce** tutti i dati locali sul dispositivo.
- **Rimborso km (ACI)** — opzionale, tramite proxy server (`api/aci-proxy`); richiede variabile `EXPO_PUBLIC_ACI_PROXY_URL` in sviluppo/build web.

## Privacy e dati

I dati restano **sul dispositivo** (SQLite su mobile; SQLite + IndexedDB per gli allegati su web). Non c’è sincronizzazione cloud integrata: per spostare i dati tra dispositivi usa **Backup e ripristino** e salva il file dove preferisci.

Su **web**, SQLite richiede un contesto sicuro (**HTTPS** o `localhost`). In HTTP non sicuro l’app mostra un messaggio dedicato.

## Requisiti

- [Node.js](https://nodejs.org/) LTS (consigliato 20+)
- npm
- Per build native: account [Expo](https://expo.dev/) e, se usi EAS, CLI `eas`

## Avvio in sviluppo

```bash
npm install
npm start          # menu Expo (QR, simulatori)
npm run ios        # simulatore / dispositivo iOS
npm run android    # emulatore / dispositivo Android
npm run web        # browser (http://localhost:8081)
```

Controlli utili:

```bash
npm run typecheck  # TypeScript app
npm run lint       # ESLint
```

## Build web (deploy statico)

```bash
npm run export:web   # output in dist/
```

Il progetto è configurato per [Vercel](https://vercel.com/) (`vercel.json`: build `export:web`, cartella `dist`).

## Variabili d’ambiente (opzionali)

Crea un file `.env` nella root (non committare segreti):

| Variabile | Uso |
|-----------|-----|
| `EXPO_PUBLIC_ACI_PROXY_URL` | URL del deploy che espone `aci-proxy` (es. Vercel). Senza questa variabile il pulsante rimborso ACI in profilo resta disabilitato. |

Dopo aver modificato `.env`, riavvia Metro (`npm start`).

## Struttura del progetto (sintesi)

| Percorso | Contenuto |
|----------|-----------|
| `app/` | Schermate [Expo Router](https://docs.expo.dev/router/introduction/) |
| `db/` | Schema e accesso SQLite |
| `utils/` | Backup, PDF, allegati, export |
| `components/` | UI condivisa (inclusi componenti web per allegati) |
| `i18n/` | Stringhe IT/EN |
| `api/` | Proxy ACI e tipi server |
| `scripts/aci/` | Script Playwright per sessione ACI (uso interno) |

## Backup `.wtbackup`

Formato versione **1** (`worktracker-backup`): giorni, spese, impostazioni e mappa allegati (base64 + MIME). Utile per:

- passaggio iPhone ↔ PC (browser);
- copia di sicurezza prima di reinstallare l’app;
- archivio su cloud personale senza account Microsoft aziendale nell’app.

## Repository e OneDrive

Se il clone vive sotto **OneDrive**, evita di sincronizzare la cartella `.git` (lock su `objects` durante `git commit`). Preferisci una copia locale del repo o escludi `.git` dalla sincronizzazione.

## Licenza

Progetto **privato** (`package.json`: `"private": true`).
