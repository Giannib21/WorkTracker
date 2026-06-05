export type AppLanguage = 'it' | 'en';

export type DayOreWarnParts = {
  oreN: number;
  baseline: number;
  H: number;
  travelCtx: string;
  permessoCtx: string;
};

export type Messages = {
  tabHome: string;
  tabSpese: string;
  tabProfilo: string;
  tabImpostazioni: string;
  profileScreenTitle: string;
  profileSaveButton: string;
  profileSavedTitle: string;
  profileSavedBody: string;
  profileSaveErr: string;
  profileCarCostModeTitle: string;
  profileCarCostModeManual: string;
  profileCarCostModeAuto: string;
  homeTodayA11ySuffix: string;
  reset: string;
  export: string;
  resetMonthTitle: string;
  resetMonthMessage: (monthTitle: string) => string;
  resetCancel: string;
  resetSoloPresenze: string;
  resetSoloSpese: string;
  resetPresenzeESpese: string;
  resetErrPresenze: string;
  resetErrSpese: string;
  resetErr: string;
  errorTitle: string;
  weekInitials: [string, string, string, string, string, string, string];
  homeSummaryTitle: string;
  homeSummaryDays: string;
  homeSummaryHours: string;
  homeSummaryTravel: string;
  homeSummaryLeave: string;
  homeSummarySick: string;
  homeSummaryExpenses: string;
  homeSummaryExpenseCount: string;
  homeAccPrevMonth: string;
  homeAccNextMonth: string;
  exportTitle: string;
  exportBack: string;
  exportGeneratePdf: string;
  exportGenerateExcel: string;
  exportSendEmail: string;
  exportPdfDialogTitle: string;
  exportPdfDialogHint: string;
  exportPdfOptionPresenze: string;
  exportPdfOptionSpese: string;
  exportPdfOptionCompleto: string;
  exportAttachDialogTitle: string;
  exportAttachDialogHint: string;
  exportAttachWithout: string;
  exportAttachWith: string;
  exportMailSubject: (monthTitle: string) => string;
  exportMailBody: (monthTitle: string, nomeUtente: string) => string;
  settingsTitle: string;
  settingsLanguage: string;
  settingsLanguageIt: string;
  settingsLanguageEn: string;
  settingsLanguageHint: string;
  settingsAboutTitle: string;
  settingsAboutSubtitle: string;
  settingsAboutAuthor: string;
  settingsAboutVersion: (ver: string) => string;
  settingsAboutRelease: string;
  settingsAboutChannel: string;
  settingsAboutPrivacyTitle: string;
  settingsAboutPrivacyBody: string;
  settingsProfileTitle: string;
  settingsEmployeeName: string;
  settingsMatricola: string;
  settingsUfficio: string;
  settingsCompanyLocked: string;
  settingsCompanyAddress: string;
  settingsCfPiva: string;
  settingsEmailManager: string;
  settingsDefaultHoursTitle: string;
  settingsDefaultHoursHint: string;
  settingsOreLunGio: string;
  settingsOreVen: string;
  settingsLocalHolidaysTitle: string;
  settingsLocalHolidaysHint: string;
  settingsLocalHolidaysSwitchLabel: string;
  settingsLocalHolidaysAutoDetected: (comune: string, nome: string, ddmm: string) => string;
  settingsLocalHolidaysManualPrompt: string;
  settingsLocalHolidaysManualLabel: string;
  settingsLocalHolidaysManualPlaceholder: string;
  settingsLocalHolidaysDisclaimer: string;
  settingsCarTitle: string;
  settingsCarModel: string;
  settingsEurPerKm: string;
  settingsDecimalHint: string;
  aciWizardTitle: string;
  aciWizardVehicleTypeLabel: string;
  aciWizardVehicleTypeCar: string;
  aciWizardVehicleTypeSuv: string;
  aciWizardVehicleTypeMoto: string;
  aciWizardLoadBrands: string;
  aciWizardSelectBrand: string;
  aciWizardSelectFuel: string;
  aciWizardSelectModel: string;
  aciWizardPickPlaceholder: string;
  aciWizardDateLabel: string;
  aciWizardNetAmount: string;
  aciWizardReset: string;
  aciWizardErrGeneric: string;
  aciWizardErrIncomplete: string;
  aciWizardOpenOfficialCalculator: string;
  aciWizardCostFetchButton: string;
  aciWizardCostFetchProxyRequired: string;
  aciWizardSessionExpired: string;
  aciWizardKeycloakTokenRequired: string;
  aciWizardResultTitle: string;
  aciWizardPersonalUseCheckbox: string;
  aciWizardApplyRate: string;
  aciWizardKmBandsHint: string;
  aciWizardAnnualKmLabel: string;
  aciWizardAnnualKmHelper: string;
  aciWizardEurPerKmAutoApplied: (userKm: number, bandKm: number, eurPerKm: string) => string;
  aciWizardBandsTableTitle: string;
  aciWizardBandsTableHint: string;
  aciWizardBandsColBand: string;
  aciWizardBandsColRate: string;
  settingsSaveButton: string;
  settingsSavedTitle: string;
  settingsSavedBody: string;
  settingsSaveErr: string;
  settingsBackupTitle: string;
  settingsBackupHint: string;
  settingsBackupCreateButton: string;
  settingsBackupRestoreButton: string;
  settingsBackupRestoreConfirmTitle: string;
  settingsBackupRestoreConfirmMessage: (summary: string) => string;
  settingsBackupRestoreConfirmOk: string;
  settingsBackupRestoreConfirmCancel: string;
  settingsBackupSuccessTitle: string;
  settingsBackupSuccessBody: (summary: string, sizeLabel: string) => string;
  settingsBackupRestoreSuccessTitle: string;
  settingsBackupRestoreSuccessBody: string;
  settingsBackupErrGeneric: string;
  settingsBackupErrShare: string;
  settingsBackupErrInvalid: string;
  settingsBackupErrUnsupported: string;
  exportMailUnavailable: string;
  /** Web: flusso email PDF (mailto non allega file; vedi dialog export). */
  exportWebMailHint: string;
  exportWebMailDialogTitle: string;
  exportWebMailDialogBody: string;
  exportWebMailSharePdf: string;
  exportWebMailOpenMailApp: string;
  exportWebMailDownloadPdf: string;
  exportWebMailShareError: string;
  exportErrPdf: string;
  exportErrExcel: string;
  exportErrEmail: string;
  resetDayTitle: string;
  resetDayMessage: string;
  resetDayErrPresenze: string;
  resetDayErrSpese: string;
  resetDayErr: string;
  resetDayButton: string;
  permDeniedTitle: string;
  permLocationBody: string;
  permGalleryBody: string;
  permCameraBody: string;
  gpsFailedBody: string;
  genericImageImportErr: string;
  genericDocImportErr: string;
  genericPhotoCaptureErr: string;
  alertSaved: string;
  /** iOS: pulsante barra tastiera numerica per chiudere. */
  keyboardDone: string;
  dayScreenTitle: string;
  dayPrevA11y: string;
  dayNextA11y: string;
  dayInvalidDateReason: string;
  dayHolidayReadonly: (nomeFest: string) => string;
  dayWeekendReadonly: string;
  dayNonModificabileBadge: string;
  dayPresenzeTitle: string;
  dayOreLavorate: string;
  dayOreTrasfertaRow: string;
  dayOreLeaveRow: string;
  dayMalattiaRow: string;
  dayOreTrasfertaPlaceholder: string;
  dayTrasfertaDetailTitle: string;
  dayLuogoObbligatorio: string;
  dayLuogo: string;
  dayGpsShort: string;
  dayProgettoObbligatorio: string;
  dayProgetto: string;
  dayOrePermessoPlaceholder: string;
  dayFerieInteraGiornata: string;
  dayMalattiaGiorno: string;
  dayTipoLavoro: string;
  dayTipoTrasfertaFull: string;
  dayNoteLabel: string;
  daySalva: string;
  daySpeseDelGiorno: string;
  dayNessunaSpesaGiorno: string;
  dayAggiungiSpesa: string;
  dayOreCtxTrasferta: (ore: number | string) => string;
  dayOreCtxPermesso: (ore: number | string) => string;
  dayOreWarnOvertime: (p: DayOreWarnParts) => string;
  dayOreWarnUndertime: (p: DayOreWarnParts) => string;
  dayNotEditableTitle: string;
  dayHoursMustBeZero: string;
  dayTrasferMissingPlaceProject: string;
  dayHoursCheckTitle: string;
  dayEditAction: string;
  daySaveAnywayAction: string;
  daySavedBody: string;
  daySaveFailed: string;
  dayExtendTitle: string;
  dayExtendMessageTrasfertaFull: string;
  dayExtendMessageTrasferta8h: string;
  dayExtendMessageFerie: string;
  dayExtendMessageMalattia: string;
  dayExtendEndDateLabel: string;
  dayExtendDayCount: (n: number) => string;
  dayExtendCancel: string;
  dayExtendOnlyToday: string;
  dayExtendConfirm: string;
  daySavedExtendedBody: (n: number) => string;
  listSpeseTotalsMonth: string;
  listSpeseNuova: string;
  listSpeseEmptyMonth: string;
  expNewTitle: string;
  expEditTitle: string;
  expDettagliSection: string;
  expDateLabel: string;
  expCategoriaTitolo: string;
  expGroupTravelTransport: string;
  expGroupRestHotel: string;
  expGroupOther: string;
  expLocalitaObbl: string;
  expProgettoObbl: string;
  expImporto: string;
  expValuta: string;
  expDescrizione: string;
  expKmSectionTitle: string;
  expKmDa: string;
  expKmA: string;
  expKmField: string;
  expKmEurKm: string;
  expKmModello: string;
  expKmComputed: string;
  expKmSavedCarToggle: string;
  expKmSavedCarHint: string;
  expKmSavedCarUnavailable: string;
  expDocSection: string;
  expDocHint: string;
  expFotocamera: string;
  expGalleria: string;
  expFile: string;
  expRimuovi: string;
  expAllegatoLabel: string;
  expOpenAttachment: string;
  expEliminaDomandaTitle: string;
  expEliminaDomandaBody: string;
  expEliminaSi: string;
  expInsertedTitle: string;
  expInsertedBody: string;
  expUpdatedTitle: string;
  expUpdatedBody: string;
  expSavedErr: string;
  expDeleteErr: string;
  expNonTrovataTitle: string;
  expNonTrovataBody: string;
  expLoadErrBody: string;
  expMissingDate: string;
  expKmMissingItinerary: string;
  expMissingLocationProject: string;
  expInvalidAmountTitle: string;
  expInvalidAmountBody: string;
};

const IT: Messages = {
  tabHome: 'Home',
  tabSpese: 'Spese',
  tabProfilo: 'Profilo',
  tabImpostazioni: 'Impostazioni',
  profileScreenTitle: 'Dati collaboratore',
  profileSaveButton: 'Salva dati',
  profileSavedTitle: 'Salvato',
  profileSavedBody: 'Dati collaboratore aggiornati.',
  profileSaveErr: 'Impossibile salvare i dati.',
  profileCarCostModeTitle: 'Modello e €/km',
  profileCarCostModeManual: 'Manuale',
  profileCarCostModeAuto: 'Automatico',
  homeTodayA11ySuffix: 'oggi',
  reset: 'Reset',
  export: 'Export',
  resetMonthTitle: 'Reset mese',
  resetMonthMessage: (monthTitle) =>
    `Ripristinare i dati di ${monthTitle} ai default? L'operazione non si può annullare.`,
  resetCancel: 'Annulla',
  resetSoloPresenze: 'Solo presenze',
  resetSoloSpese: 'Solo spese',
  resetPresenzeESpese: 'Presenze e spese',
  resetErrPresenze: 'Impossibile completare il reset delle presenze.',
  resetErrSpese: 'Impossibile completare il reset delle spese.',
  resetErr: 'Impossibile completare il reset.',
  errorTitle: 'Errore',
  weekInitials: ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
  homeSummaryTitle: 'Riepilogo mese',
  homeSummaryDays: 'Giorni salvati nel DB',
  homeSummaryHours: 'Ore lavoro',
  homeSummaryTravel: 'Ore trasferta',
  homeSummaryLeave: 'Ore ferie / permessi',
  homeSummarySick: 'Ore malattia',
  homeSummaryExpenses: 'Totale spese',
  homeSummaryExpenseCount: 'Movimenti spese',
  homeAccPrevMonth: 'Mese precedente',
  homeAccNextMonth: 'Mese successivo',
  exportTitle: 'Export',
  exportBack: '← Indietro',
  exportGeneratePdf: 'Genera PDF',
  exportGenerateExcel: 'Esporta Excel',
  exportSendEmail: 'Invia email (PDF allegato)',
  exportPdfDialogTitle: 'Esportazione PDF',
  exportPdfDialogHint: 'Scegli cosa includere nel PDF.',
  exportPdfOptionPresenze: 'Presenze',
  exportPdfOptionSpese: 'Nota spese',
  exportPdfOptionCompleto: 'Presenze e nota spese',
  exportAttachDialogTitle: 'Allegati ricevute',
  exportAttachDialogHint:
    'Vuoi includere nel PDF foto/PDF delle ricevute nella sezione nota spese?',
  exportAttachWithout: 'Senza allegati',
  exportAttachWith: 'Con allegati',
  exportMailSubject: (monthTitle) => `WorkTracker — ${monthTitle}`,
  exportMailBody: (monthTitle, nomeUtente) =>
    `Ciao,\n\nin allegato trovi il report mensile ${monthTitle}.\n\nGrazie,\n${nomeUtente}`.trim(),
  settingsTitle: 'Impostazioni',
  settingsLanguage: 'Lingua interfaccia',
  settingsLanguageIt: 'Italiano',
  settingsLanguageEn: 'English',
  settingsLanguageHint: 'Date e nomi dei mesi seguono la lingua scelta.',
  settingsAboutTitle: 'Informazioni',
  settingsAboutSubtitle: 'WorkTracker — presenze e spese',
  settingsAboutAuthor: 'Creata con amore da Gianfranco Buonomo.',
  settingsAboutVersion: (ver) => `Versione ${ver}`,
  settingsAboutRelease: 'Prima release: maggio 2026',
  settingsAboutChannel: 'Distribuzione: beta (il feedback è benvenuto).',
  settingsAboutPrivacyTitle: 'Privacy in sintesi',
  settingsAboutPrivacyBody:
    'I dati (presenze, spese, impostazioni) restano sul dispositivo, in un database locale. L’app non richiede account e non invia i tuoi movimenti a server remoti. Un backup completo verso il tuo cloud (OneDrive, Drive, ecc.) avviene solo se lo crei tu da Impostazioni. Email con PDF allegato, condivisione export, fotocamera, galleria e posizione entrano in gioco solo quando usi quelle funzioni in modo esplicito.',
  settingsProfileTitle: 'Profilo',
  settingsEmployeeName: 'Nome dipendente / collaboratore',
  settingsMatricola: 'Numero matricola',
  settingsUfficio: 'Ufficio',
  settingsCompanyLocked: 'Azienda',
  settingsCompanyAddress: 'Indirizzo azienda',
  settingsCfPiva: 'C.F. / P.IVA',
  settingsEmailManager: 'Email office manager',
  settingsDefaultHoursTitle: 'Ore di default',
  settingsDefaultHoursHint: 'Usate per precompilare le giornate “Lavoro”.',
  settingsOreLunGio: 'Lunedì–Giovedì',
  settingsOreVen: 'Venerdì',
  settingsLocalHolidaysTitle: 'Festività locali',
  settingsLocalHolidaysHint:
    'Oltre alle festività nazionali, l’app può segnare il giorno del patrono per i soli capoluoghi di provincia, ricavando il comune dall’indirizzo aziendale salvato. Se la sede non è in un capoluogo, indica una data fissa in formato GG/MM.',
  settingsLocalHolidaysSwitchLabel: 'Includi festività locale (capoluogo o data sotto)',
  settingsLocalHolidaysAutoDetected: (comune, nome, ddmm) =>
    `Capoluogo riconosciuto da indirizzo aziendale: ${comune} — ${nome} (${ddmm}).`,
  settingsLocalHolidaysManualPrompt:
    'Indirizzo non corrisponde a un capoluogo di provincia nell’elenco: indica il giorno della festività locale (GG/MM, ricorrente ogni anno).',
  settingsLocalHolidaysManualLabel: 'Data festività locale (GG/MM)',
  settingsLocalHolidaysManualPlaceholder: 'GG/MM',
  settingsLocalHolidaysDisclaimer:
    'Le date dei capoluoghi sono tratte da fonti pubbliche e possono non coincidere con il tuo CCNL o accordo aziendale. Verifica sempre in HR.',
  settingsCarTitle: 'Auto / Rimborso km',
  settingsCarModel: 'Modello auto',
  settingsEurPerKm: '€/km (decimale)',
  settingsDecimalHint: 'Usa virgola o punto per i decimali (es. 0,35 €/km).',
  aciWizardTitle: 'Ricerca veicolo (ACI costi km)',
  aciWizardVehicleTypeLabel: 'Tipo mezzo',
  aciWizardVehicleTypeCar: 'Autovettura',
  aciWizardVehicleTypeSuv: 'Fuoristrada / SUV',
  aciWizardVehicleTypeMoto: 'Motociclo',
  aciWizardLoadBrands: 'Carica marche',
  aciWizardSelectBrand: 'Marca',
  aciWizardSelectFuel: 'Carburante',
  aciWizardSelectModel: 'Modello',
  aciWizardPickPlaceholder: 'Scegli…',
  aciWizardDateLabel: 'Data (GG-MM-AAAA)',
  aciWizardNetAmount: 'Importo netto (IVA esclusa)',
  aciWizardReset: 'Azzera selezione',
  aciWizardErrGeneric: 'Richiesta non riuscita.',
  aciWizardErrIncomplete: 'Seleziona marca, carburante e modello.',
  aciWizardOpenOfficialCalculator: 'Apri calcolo ufficiale ACI',
  aciWizardCostFetchButton: 'Richiedi dati costo',
  aciWizardCostFetchProxyRequired:
    'Imposta `EXPO_PUBLIC_ACI_PROXY_URL` verso il deploy che espone `aci-proxy` (e riavvia Metro) per abilitare il pulsante.',
  aciWizardSessionExpired: 'Sessione non valida (401). Riprova più tardi o verifica il proxy.',
  aciWizardKeycloakTokenRequired:
    "L'API ACI ha risposto 403: serve un JWT Keycloak sul proxy. Su Vercel imposta `ACI_COSTIKM_KEYCLOAK_TOKEN` con il valore di `localStorage.token` dopo login CIE/SPID su costikm.aci.it (es. `npm run aci:capture`), poi redeploy. Il solo captcha risolto non basta per `/costs` in produzione.",
  aciWizardResultTitle: 'Stima costi al km',
  aciWizardPersonalUseCheckbox:
    'Dichiaro di utilizzare questa funzione esclusivamente per finalità personali e non commerciali, senza rivendita o ridistribuzione dei dati, nel rispetto dei termini di servizio delle fonti e della normativa applicabile.',
  aciWizardApplyRate: 'Applica al campo €/km',
  aciWizardKmBandsHint:
    'Se compaiono più fasce chilometriche, scegli quella adatta o indica i km annui per applicare automaticamente il €/km corretto.',
  aciWizardAnnualKmLabel: 'stima km annui percorsi - (opzionale)',
  aciWizardAnnualKmHelper:
    "Inserisci la stima dei km percorsi nell'anno per ottenere direttamente il costo €/km corretto. Diversamente, ti verrà mostrata l'intera tabella, quindi dovrai selezionare la fascia corretta.",
  aciWizardEurPerKmAutoApplied: (userKm, bandKm, eurPerKm) =>
    `Campo €/km aggiornato automaticamente: ${eurPerKm} €/km (fascia fino a ${bandKm} km/anno, in base ai ${userKm} km indicati).`,
  aciWizardBandsTableTitle: 'Fasce €/km dalla risposta',
  aciWizardBandsTableHint:
    'Indica i km annui nel campo opzionale sopra per applicare subito la fascia corretta al €/km. Oppure tocca una riga della tabella.',
  aciWizardBandsColBand: 'Fino a km/anno',
  aciWizardBandsColRate: '€/km',
  settingsSaveButton: 'Salva impostazioni',
  settingsSavedTitle: 'Salvato',
  settingsSavedBody: 'Impostazioni aggiornate.',
  settingsSaveErr: 'Impossibile salvare le impostazioni.',
  settingsBackupTitle: 'Backup e ripristino',
  settingsBackupHint:
    'Esporta tutti i dati (presenze, spese, profilo, impostazioni e allegati ricevute) in un file. Salvalo su OneDrive, Google Drive, iCloud o dove preferisci. Su un altro dispositivo usa «Ripristina» per sostituire i dati locali con quelli del backup.',
  settingsBackupCreateButton: 'Crea backup',
  settingsBackupRestoreButton: 'Ripristina da file',
  settingsBackupRestoreConfirmTitle: 'Ripristinare il backup?',
  settingsBackupRestoreConfirmMessage: (summary) =>
    `I dati attuali su questo dispositivo verranno sostituiti.\n\n${summary}`,
  settingsBackupRestoreConfirmOk: 'Ripristina',
  settingsBackupRestoreConfirmCancel: 'Annulla',
  settingsBackupSuccessTitle: 'Backup pronto',
  settingsBackupSuccessBody: (summary, sizeLabel) =>
    `File creato (${sizeLabel}). Usa il menu di sistema per salvarlo nel tuo cloud.\n\n${summary}`,
  settingsBackupRestoreSuccessTitle: 'Ripristino completato',
  settingsBackupRestoreSuccessBody:
    'Dati e allegati ripristinati. Torna alla Home o alle Spese per vedere i contenuti aggiornati.',
  settingsBackupErrGeneric: 'Operazione non riuscita. Riprova.',
  settingsBackupErrShare: 'Condivisione non disponibile su questo dispositivo.',
  settingsBackupErrInvalid: 'File non valido o danneggiato. Verifica di aver scelto un backup WorkTracker (.wtbackup).',
  settingsBackupErrUnsupported: 'Versione backup non supportata. Aggiorna l’app e riprova.',
  exportMailUnavailable: 'Mail Composer non è disponibile su questo dispositivo.',
  exportWebMailHint:
    'Su web il PDF non può essere allegato automaticamente alla email. Usa il pulsante «Condividi PDF» dopo averlo generato.',
  exportWebMailDialogTitle: 'PDF pronto',
  exportWebMailDialogBody:
    'I browser (soprattutto su telefono) non possono allegare un file a una email da soli. Tocca «Condividi PDF» per inviarlo con Mail, Gmail o altre app; oppure «Apri email» per aprire il programma di posta con oggetto e testo già compilati (il PDF va allegato dai download, se non usi Condividi).',
  exportWebMailSharePdf: 'Condividi PDF',
  exportWebMailOpenMailApp: 'Apri email (oggetto e testo)',
  exportWebMailDownloadPdf: 'Scarica il PDF',
  exportWebMailShareError:
    'Questo browser non consente di condividere il PDF da qui. Usa «Scarica il PDF» e allegalo all’email.',
  exportErrPdf: 'Impossibile generare il PDF.',
  exportErrExcel: 'Impossibile generare il file Excel.',
  exportErrEmail: "Impossibile preparare l'email.",
  resetDayTitle: 'Reset giornata',
  resetDayMessage:
    "Ripristinare i dati di questo giorno ai default? L'operazione non si può annullare.",
  resetDayErrPresenze: 'Impossibile completare il reset delle presenze.',
  resetDayErrSpese: 'Impossibile completare il reset delle spese.',
  resetDayErr: 'Impossibile completare il reset.',
  resetDayButton: 'Reset giornata…',
  permDeniedTitle: 'Permesso negato',
  permLocationBody: 'Abilita la localizzazione per usare la posizione attuale.',
  permGalleryBody: "Serve l'accesso alla galleria per allegare una foto.",
  permCameraBody: "Serve l'accesso alla fotocamera per scattare la ricevuta.",
  gpsFailedBody: 'Impossibile ottenere la posizione attuale.',
  genericImageImportErr: "Impossibile importare l'immagine.",
  genericDocImportErr: 'Impossibile importare il documento.',
  genericPhotoCaptureErr: 'Impossibile acquisire la foto.',
  alertSaved: 'Salvato',
  keyboardDone: 'Fatto',
  dayScreenTitle: 'Giornata',
  dayPrevA11y: 'Giorno precedente nel mese',
  dayNextA11y: 'Giorno successivo nel mese',
  dayInvalidDateReason: 'Data non valida',
  dayHolidayReadonly: (nome) => (nome.trim() ? `Festività: ${nome.trim()}` : 'Festività'),
  dayWeekendReadonly: 'Weekend',
  dayNonModificabileBadge: 'Non modificabile',
  dayPresenzeTitle: 'Presenze',
  dayOreLavorate: 'Lavorate',
  dayOreTrasfertaRow: 'Trasferta',
  dayOreLeaveRow: 'Permessi / ferie',
  dayMalattiaRow: 'Malattia',
  dayOreTrasfertaPlaceholder: 'h trasferta',
  dayTrasfertaDetailTitle: 'Dettaglio trasferta',
  dayLuogoObbligatorio: 'Luogo (obbligatorio)',
  dayLuogo: 'Luogo',
  dayGpsShort: 'GPS',
  dayProgettoObbligatorio: 'Progetto (obbligatorio)',
  dayProgetto: 'Progetto',
  dayOrePermessoPlaceholder: 'h permesso',
  dayFerieInteraGiornata: 'Ferie (intera giornata)',
  dayMalattiaGiorno: 'Giornata di malattia',
  dayTipoLavoro: 'Lavoro',
  dayTipoTrasfertaFull: 'Trasferta (intera g.)',
  dayNoteLabel: 'Note',
  daySalva: 'Salva',
  daySpeseDelGiorno: 'Spese del giorno',
  dayNessunaSpesaGiorno: 'Nessuna spesa registrata.',
  dayAggiungiSpesa: '+ Aggiungi spesa',
  dayOreCtxTrasferta: (ore) => `, con ${ore}h in trasferta`,
  dayOreCtxPermesso: (ore) => `, con ${ore}h di permesso`,
  dayOreWarnOvertime: (p) =>
    `Straordinari: hai indicato ${p.oreN}h lavorate, mentre per oggi risultano previste ${p.baseline}h in sede (contratto ${p.H}h${p.travelCtx}${p.permessoCtx}).`,
  dayOreWarnUndertime: (p) =>
    `Ore sotto il minimo: hai indicato ${p.oreN}h lavorate; per questa giornata risultano previste almeno ${p.baseline}h in sede (contratto ${p.H}h${p.travelCtx}${p.permessoCtx}).`,
  dayNotEditableTitle: 'Non modificabile',
  dayHoursMustBeZero: 'Per questo tipo di giornata le ore devono essere 0.',
  dayTrasferMissingPlaceProject: 'Inserisci Luogo e Progetto/Motivazione per la trasferta.',
  dayHoursCheckTitle: 'Verifica ore lavorate',
  dayEditAction: 'Modifica',
  daySaveAnywayAction: 'Salva comunque',
  daySavedBody: 'Giornata aggiornata.',
  daySaveFailed: 'Impossibile salvare la giornata.',
  dayExtendTitle: 'Estendere ai giorni successivi?',
  dayExtendMessageTrasfertaFull:
    'Hai indicato una trasferta per l’intera giornata. Vuoi applicare la stessa compilazione anche ai giorni lavorativi successivi, fino alla data indicata?',
  dayExtendMessageTrasferta8h:
    'Hai indicato 8 ore di trasferta. Vuoi applicare la stessa compilazione anche ai giorni lavorativi successivi, fino alla data indicata?',
  dayExtendMessageFerie:
    'Hai indicato ferie per l’intera giornata. Vuoi applicare la stessa scelta anche ai giorni lavorativi successivi, fino alla data indicata?',
  dayExtendMessageMalattia:
    'Hai indicato una giornata di malattia. Vuoi applicare la stessa scelta anche ai giorni lavorativi successivi, fino alla data indicata?',
  dayExtendEndDateLabel: 'Applica fino al (incluso)',
  dayExtendDayCount: (n) => (n === 1 ? '1 giorno' : `${n} giorni`),
  dayExtendCancel: 'Annulla',
  dayExtendOnlyToday: 'Solo oggi',
  dayExtendConfirm: 'Estendi',
  daySavedExtendedBody: (n) =>
    n === 1 ? 'Giornata aggiornata.' : `Aggiornate ${n} giornate lavorative.`,
  listSpeseTotalsMonth: 'Totale mese',
  listSpeseNuova: '+ Nuova Spesa',
  listSpeseEmptyMonth: 'Nessuna spesa registrata per questo mese.',
  expNewTitle: 'Nuova Spesa',
  expEditTitle: 'Spesa',
  expDettagliSection: 'Dettagli',
  expDateLabel: 'Data (YYYY-MM-DD)',
  expCategoriaTitolo: 'Tipologia spesa',
  expGroupTravelTransport: 'Spese viaggio / trasporto',
  expGroupRestHotel: 'Ristoranti / Hotel',
  expGroupOther: 'Altre voci',
  expLocalitaObbl: 'Località (obbligatorio)',
  expProgettoObbl: 'Progetto (obbligatorio)',
  expImporto: 'Importo',
  expValuta: 'Valuta',
  expDescrizione: 'Descrizione',
  expKmSectionTitle: 'Rimborso chilometrico',
  expKmDa: 'Da (partenza)',
  expKmA: 'A (arrivo)',
  expKmField: 'Km',
  expKmEurKm: '€/km',
  expKmModello: 'Modello auto',
  expKmComputed: 'Importo calcolato:',
  expKmSavedCarToggle: 'Auto salvata',
  expKmSavedCarHint: 'Usa modello e €/km impostati in Profilo.',
  expKmSavedCarUnavailable: 'Salva modello e €/km in Profilo per poter usare questa opzione.',
  expDocSection: 'Documento / ricevuta',
  expDocHint:
    'Allega foto o PDF: verrà incluso nel report PDF del mese (le immagini sono incorporate; i PDF sono indicati nel report con il nome file).',
  expFotocamera: 'Fotocamera',
  expGalleria: 'Galleria',
  expFile: 'File',
  expRimuovi: 'Rimuovi',
  expAllegatoLabel: 'Allegato:',
  expOpenAttachment: 'Apri allegato',
  expEliminaDomandaTitle: 'Elimina spesa',
  expEliminaDomandaBody: 'Confermi eliminazione?',
  expEliminaSi: 'Elimina',
  expInsertedTitle: 'Salvata',
  expInsertedBody: 'Spesa inserita.',
  expUpdatedTitle: 'Salvata',
  expUpdatedBody: 'Spesa aggiornata.',
  expSavedErr: 'Impossibile salvare la spesa.',
  expDeleteErr: 'Impossibile eliminare la spesa.',
  expNonTrovataTitle: 'Non trovata',
  expNonTrovataBody: 'La spesa non esiste più.',
  expLoadErrBody: 'Impossibile caricare la spesa.',
  expMissingDate: 'Inserisci la data (YYYY-MM-DD).',
  expKmMissingItinerary: 'Per il rimborso km indica itinerario «Da» e «A».',
  expMissingLocationProject: 'Indica Località e Progetto.',
  expInvalidAmountTitle: 'Importo non valido',
  expInvalidAmountBody: 'Inserisci un importo maggiore di 0.',
};

const EN: Messages = {
  tabHome: 'Home',
  tabSpese: 'Expenses',
  tabProfilo: 'Profile',
  tabImpostazioni: 'Settings',
  profileScreenTitle: 'Collaborator details',
  profileSaveButton: 'Save details',
  profileSavedTitle: 'Saved',
  profileSavedBody: 'Collaborator details updated.',
  profileSaveErr: 'Could not save details.',
  profileCarCostModeTitle: 'Car model and €/km',
  profileCarCostModeManual: 'Manual',
  profileCarCostModeAuto: 'Automatic',
  homeTodayA11ySuffix: 'today',
  reset: 'Reset',
  export: 'Export',
  resetMonthTitle: 'Reset month',
  resetMonthMessage: (monthTitle) =>
    `Restore data for ${monthTitle} to defaults? This cannot be undone.`,
  resetCancel: 'Cancel',
  resetSoloPresenze: 'Timesheets only',
  resetSoloSpese: 'Expenses only',
  resetPresenzeESpese: 'Both',
  resetErrPresenze: 'Could not reset timesheets.',
  resetErrSpese: 'Could not reset expenses.',
  resetErr: 'Could not complete reset.',
  errorTitle: 'Error',
  weekInitials: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  homeSummaryTitle: 'Month summary',
  homeSummaryDays: 'Saved day records',
  homeSummaryHours: 'Work hours',
  homeSummaryTravel: 'Travel hours',
  homeSummaryLeave: 'Leave / time off hours',
  homeSummarySick: 'Sick leave hours',
  homeSummaryExpenses: 'Expense total',
  homeSummaryExpenseCount: 'Expense items',
  homeAccPrevMonth: 'Previous month',
  homeAccNextMonth: 'Next month',
  exportTitle: 'Export',
  exportBack: '← Back',
  exportGeneratePdf: 'Generate PDF',
  exportGenerateExcel: 'Export Excel',
  exportSendEmail: 'Send email (PDF attached)',
  exportPdfDialogTitle: 'PDF export',
  exportPdfDialogHint: 'Choose what to include in the PDF.',
  exportPdfOptionPresenze: 'Attendance',
  exportPdfOptionSpese: 'Expense report',
  exportPdfOptionCompleto: 'Attendance and expense report',
  exportAttachDialogTitle: 'Receipt attachments',
  exportAttachDialogHint:
    'Include embedded receipts and appendix PDF files in the expense section?',
  exportAttachWithout: 'Without attachments',
  exportAttachWith: 'With attachments',
  exportMailSubject: (monthTitle) => `WorkTracker — ${monthTitle}`,
  exportMailBody: (monthTitle, nomeUtente) =>
    `Hello,\n\nPlease find the monthly report for ${monthTitle} attached.\n\nThanks,\n${nomeUtente}`.trim(),
  settingsTitle: 'Settings',
  settingsLanguage: 'Interface language',
  settingsLanguageIt: 'Italian',
  settingsLanguageEn: 'English',
  settingsLanguageHint: 'Dates and month names follow the selected language.',
  settingsAboutTitle: 'About',
  settingsAboutSubtitle: 'WorkTracker — attendance and expenses',
  settingsAboutAuthor: 'Made with love by Gianfranco Buonomo.',
  settingsAboutVersion: (ver) => `Version ${ver}`,
  settingsAboutRelease: 'First release: May 2026',
  settingsAboutChannel: 'Distribution: public beta (feedback welcome).',
  settingsAboutPrivacyTitle: 'Privacy at a glance',
  settingsAboutPrivacyBody:
    'Your data (timesheets, expenses, settings) stays on the device in a local database. The app does not require an account and does not send your entries to remote servers. A full backup to your own cloud (OneDrive, Drive, etc.) only happens if you create it from Settings. Email with PDF attachment, file sharing, camera, photo library, and location are used only when you explicitly choose those features.',
  settingsProfileTitle: 'Profile',
  settingsEmployeeName: 'Employee / contractor name',
  settingsMatricola: 'Employee ID',
  settingsUfficio: 'Office',
  settingsCompanyLocked: 'Company',
  settingsCompanyAddress: 'Company address',
  settingsCfPiva: 'Tax ID / VAT',
  settingsEmailManager: 'Office manager email',
  settingsDefaultHoursTitle: 'Default hours',
  settingsDefaultHoursHint: 'Used to pre-fill “Work” days.',
  settingsOreLunGio: 'Mon–Thu',
  settingsOreVen: 'Fri',
  settingsLocalHolidaysTitle: 'Local public holidays',
  settingsLocalHolidaysHint:
    'In addition to national holidays, the app can mark the patron feast day for Italian provincial capitals only, inferring the city from the saved company address. If the office is not in one of those cities, enter a fixed date as DD/MM.',
  settingsLocalHolidaysSwitchLabel: 'Include local holiday (capital city or date below)',
  settingsLocalHolidaysAutoDetected: (comune, nome, ddmm) =>
    `Provincial capital detected from company address: ${comune} — ${nome} (${ddmm}).`,
  settingsLocalHolidaysManualPrompt:
    'The address does not match a provincial capital in our list: enter your local holiday date (DD/MM, recurring every year).',
  settingsLocalHolidaysManualLabel: 'Local holiday date (DD/MM)',
  settingsLocalHolidaysManualPlaceholder: 'DD/MM',
  settingsLocalHolidaysDisclaimer:
    'Capital-city dates are compiled from public sources and may not match your collective agreement or company policy. Always confirm with HR.',
  settingsCarTitle: 'Car / mileage',
  settingsCarModel: 'Car model',
  settingsEurPerKm: '€/km (decimal)',
  settingsDecimalHint: 'Use comma or dot for decimals (e.g. 0.35 €/km).',
  aciWizardTitle: 'Vehicle lookup (ACI mileage costs)',
  aciWizardVehicleTypeLabel: 'Vehicle type',
  aciWizardVehicleTypeCar: 'Car',
  aciWizardVehicleTypeSuv: 'SUV / off-road',
  aciWizardVehicleTypeMoto: 'Motorcycle',
  aciWizardLoadBrands: 'Load brands',
  aciWizardSelectBrand: 'Brand',
  aciWizardSelectFuel: 'Fuel',
  aciWizardSelectModel: 'Model',
  aciWizardPickPlaceholder: 'Choose…',
  aciWizardDateLabel: 'Date (DD-MM-YYYY)',
  aciWizardNetAmount: 'Net amount (excl. VAT)',
  aciWizardReset: 'Clear selection',
  aciWizardErrGeneric: 'Request failed.',
  aciWizardErrIncomplete: 'Select brand, fuel, and model.',
  aciWizardOpenOfficialCalculator: 'Open official ACI calculator',
  aciWizardCostFetchButton: 'Request cost data',
  aciWizardCostFetchProxyRequired:
    'Set `EXPO_PUBLIC_ACI_PROXY_URL` to your `aci-proxy` deployment (and restart Metro) to enable the button.',
  aciWizardSessionExpired: 'Invalid session (401). Retry later or check the proxy.',
  aciWizardKeycloakTokenRequired:
    'The ACI API returned 403: the proxy needs a Keycloak JWT. On Vercel set `ACI_COSTIKM_KEYCLOAK_TOKEN` to your `localStorage.token` after logging in to costikm.aci.it (e.g. `npm run aci:capture`), then redeploy. A solved captcha alone is not enough for `/costs` in production.',
  aciWizardResultTitle: 'Estimated cost per km',
  aciWizardPersonalUseCheckbox:
    'I confirm I use this feature solely for personal, non-commercial purposes, without resale or redistribution of the data, in compliance with the applicable terms of service and law.',
  aciWizardApplyRate: 'Apply to €/km field',
  aciWizardKmBandsHint:
    'If several mileage bands appear, pick the right one or enter annual km to apply the matching €/km automatically.',
  aciWizardAnnualKmLabel: 'Estimated annual km driven — (optional)',
  aciWizardAnnualKmHelper:
    'Enter your estimate of km driven per year to get the correct €/km cost applied directly. Otherwise you will see the full table and must pick the right band yourself.',
  aciWizardEurPerKmAutoApplied: (userKm, bandKm, eurPerKm) =>
    `€/km field updated automatically: ${eurPerKm} €/km (band up to ${bandKm} km/year, from your ${userKm} km entered).`,
  aciWizardBandsTableTitle: '€/km bands from response',
  aciWizardBandsTableHint:
    'Enter annual km in the optional field above to apply the matching band automatically, or tap a table row.',
  aciWizardBandsColBand: 'Up to km/year',
  aciWizardBandsColRate: '€/km',
  settingsSaveButton: 'Save settings',
  settingsSavedTitle: 'Saved',
  settingsSavedBody: 'Settings updated.',
  settingsSaveErr: 'Could not save settings.',
  settingsBackupTitle: 'Backup and restore',
  settingsBackupHint:
    'Export all data (attendance, expenses, profile, settings, and receipt attachments) to a file. Save it to OneDrive, Google Drive, iCloud, or anywhere you trust. On another device, use “Restore” to replace local data with the backup.',
  settingsBackupCreateButton: 'Create backup',
  settingsBackupRestoreButton: 'Restore from file',
  settingsBackupRestoreConfirmTitle: 'Restore backup?',
  settingsBackupRestoreConfirmMessage: (summary) =>
    `Data on this device will be replaced.\n\n${summary}`,
  settingsBackupRestoreConfirmOk: 'Restore',
  settingsBackupRestoreConfirmCancel: 'Cancel',
  settingsBackupSuccessTitle: 'Backup ready',
  settingsBackupSuccessBody: (summary, sizeLabel) =>
    `File created (${sizeLabel}). Use the system menu to save it to your cloud.\n\n${summary}`,
  settingsBackupRestoreSuccessTitle: 'Restore complete',
  settingsBackupRestoreSuccessBody:
    'Data and attachments restored. Go to Home or Expenses to see updated content.',
  settingsBackupErrGeneric: 'Operation failed. Please try again.',
  settingsBackupErrShare: 'Sharing is not available on this device.',
  settingsBackupErrInvalid: 'Invalid or corrupted file. Choose a WorkTracker backup (.wtbackup).',
  settingsBackupErrUnsupported: 'Unsupported backup version. Update the app and try again.',
  exportMailUnavailable: 'Mail is not available on this device.',
  exportWebMailHint:
    'On the web the PDF cannot be attached to email automatically. After generating it, use “Share PDF”.',
  exportWebMailDialogTitle: 'PDF ready',
  exportWebMailDialogBody:
    'Browsers—especially on phones—cannot attach a file to an email by themselves. Tap “Share PDF” to send it via Mail, Gmail, or another app; or “Open email” to open your mail app with subject and body filled in (attach the PDF from Downloads if you did not use Share).',
  exportWebMailSharePdf: 'Share PDF',
  exportWebMailOpenMailApp: 'Open email (subject & body)',
  exportWebMailDownloadPdf: 'Download PDF',
  exportWebMailShareError:
    'This browser cannot share the PDF from here. Use “Download PDF” and attach it manually.',
  exportErrPdf: 'Could not generate the PDF.',
  exportErrExcel: 'Could not generate the Excel file.',
  exportErrEmail: 'Could not prepare the email.',
  resetDayTitle: 'Reset day',
  resetDayMessage: 'Restore this day to defaults? This cannot be undone.',
  resetDayErrPresenze: 'Could not reset timesheets.',
  resetDayErrSpese: 'Could not reset expenses.',
  resetDayErr: 'Could not complete reset.',
  resetDayButton: 'Reset day…',
  permDeniedTitle: 'Permission denied',
  permLocationBody: 'Enable location to use your current position.',
  permGalleryBody: 'Photo library access is needed to attach a photo.',
  permCameraBody: 'Camera access is needed to take a receipt photo.',
  gpsFailedBody: 'Could not get your current location.',
  genericImageImportErr: 'Could not import the image.',
  genericDocImportErr: 'Could not import the document.',
  genericPhotoCaptureErr: 'Could not take the photo.',
  alertSaved: 'Saved',
  keyboardDone: 'Done',
  dayScreenTitle: 'Day',
  dayPrevA11y: 'Previous day in month',
  dayNextA11y: 'Next day in month',
  dayInvalidDateReason: 'Invalid date',
  dayHolidayReadonly: (nome) => (nome.trim() ? `Holiday: ${nome.trim()}` : 'Holiday'),
  dayWeekendReadonly: 'Weekend',
  dayNonModificabileBadge: 'Read-only',
  dayPresenzeTitle: 'Attendance',
  dayOreLavorate: 'Worked',
  dayOreTrasfertaRow: 'Travel',
  dayOreLeaveRow: 'Leave / vacation',
  dayMalattiaRow: 'Sick leave',
  dayOreTrasfertaPlaceholder: 'Travel hours',
  dayTrasfertaDetailTitle: 'Travel details',
  dayLuogoObbligatorio: 'Location (required)',
  dayLuogo: 'Location',
  dayGpsShort: 'GPS',
  dayProgettoObbligatorio: 'Project / reason (required)',
  dayProgetto: 'Project / reason',
  dayOrePermessoPlaceholder: 'Leave hours',
  dayFerieInteraGiornata: 'Vacation (full day)',
  dayMalattiaGiorno: 'Sick leave',
  dayTipoLavoro: 'Work',
  dayTipoTrasfertaFull: 'Travel (full day)',
  dayNoteLabel: 'Notes',
  daySalva: 'Save',
  daySpeseDelGiorno: 'Expenses for this day',
  dayNessunaSpesaGiorno: 'No expenses recorded.',
  dayAggiungiSpesa: '+ Add expense',
  dayOreCtxTrasferta: (ore) => `, including ${ore}h travel`,
  dayOreCtxPermesso: (ore) => `, including ${ore}h leave`,
  dayOreWarnOvertime: (p) =>
    `Overtime: you entered ${p.oreN}h worked, but today’s expected on-site hours are ${p.baseline}h (contract ${p.H}h${p.travelCtx}${p.permessoCtx}).`,
  dayOreWarnUndertime: (p) =>
    `Below minimum hours: you entered ${p.oreN}h worked; this day expects at least ${p.baseline}h on-site (contract ${p.H}h${p.travelCtx}${p.permessoCtx}).`,
  dayNotEditableTitle: 'Cannot edit',
  dayHoursMustBeZero: 'For this day type, hours worked must be 0.',
  dayTrasferMissingPlaceProject: 'Enter Location and Project / travel reason.',
  dayHoursCheckTitle: 'Check worked hours',
  dayEditAction: 'Edit',
  daySaveAnywayAction: 'Save anyway',
  daySavedBody: 'Day updated.',
  daySaveFailed: 'Could not save the day.',
  dayExtendTitle: 'Extend to following days?',
  dayExtendMessageTrasfertaFull:
    'You entered a full-day travel entry. Apply the same entry to the following working days until the date below?',
  dayExtendMessageTrasferta8h:
    'You entered 8 hours of travel. Apply the same entry to the following working days until the date below?',
  dayExtendMessageFerie:
    'You entered a full vacation day. Apply the same choice to the following working days until the date below?',
  dayExtendMessageMalattia:
    'You entered a sick day. Apply the same choice to the following working days until the date below?',
  dayExtendEndDateLabel: 'Apply through (inclusive)',
  dayExtendDayCount: (n) => (n === 1 ? '1 day' : `${n} days`),
  dayExtendCancel: 'Cancel',
  dayExtendOnlyToday: 'Today only',
  dayExtendConfirm: 'Extend',
  daySavedExtendedBody: (n) =>
    n === 1 ? 'Day updated.' : `Updated ${n} working days.`,
  listSpeseTotalsMonth: 'Month total',
  listSpeseNuova: '+ New expense',
  listSpeseEmptyMonth: 'No expenses recorded this month.',
  expNewTitle: 'New expense',
  expEditTitle: 'Expense',
  expDettagliSection: 'Details',
  expDateLabel: 'Date (YYYY-MM-DD)',
  expCategoriaTitolo: 'Category',
  expGroupTravelTransport: 'Travel & transport',
  expGroupRestHotel: 'Restaurants & hotel',
  expGroupOther: 'Other',
  expLocalitaObbl: 'Location (required)',
  expProgettoObbl: 'Project (required)',
  expImporto: 'Amount',
  expValuta: 'Currency',
  expDescrizione: 'Description',
  expKmSectionTitle: 'Mileage reimbursement',
  expKmDa: 'From (start)',
  expKmA: 'To (end)',
  expKmField: 'Km',
  expKmEurKm: '€/km',
  expKmModello: 'Car model',
  expKmComputed: 'Calculated amount:',
  expKmSavedCarToggle: 'Saved car',
  expKmSavedCarHint: 'Uses the car model and €/km from Profile.',
  expKmSavedCarUnavailable: 'Save car model and €/km in Profile to enable this option.',
  expDocSection: 'Receipt / document',
  expDocHint:
    'Attach a photo or PDF: it will be included in the monthly PDF report (images are embedded; PDFs are listed with the file name).',
  expFotocamera: 'Camera',
  expGalleria: 'Gallery',
  expFile: 'File',
  expRimuovi: 'Remove',
  expAllegatoLabel: 'Attachment:',
  expOpenAttachment: 'Open attachment',
  expEliminaDomandaTitle: 'Delete expense',
  expEliminaDomandaBody: 'Delete this expense?',
  expEliminaSi: 'Delete',
  expInsertedTitle: 'Saved',
  expInsertedBody: 'Expense added.',
  expUpdatedTitle: 'Saved',
  expUpdatedBody: 'Expense updated.',
  expSavedErr: 'Could not save the expense.',
  expDeleteErr: 'Could not delete the expense.',
  expNonTrovataTitle: 'Not found',
  expNonTrovataBody: 'This expense no longer exists.',
  expLoadErrBody: 'Could not load the expense.',
  expMissingDate: 'Enter the date (YYYY-MM-DD).',
  expKmMissingItinerary: 'For mileage reimbursement, fill in “From” and “To”.',
  expMissingLocationProject: 'Enter Location and Project.',
  expInvalidAmountTitle: 'Invalid amount',
  expInvalidAmountBody: 'Enter an amount greater than 0.',
};

export const UI_MESSAGES: Record<AppLanguage, Messages> = {
  it: IT,
  en: EN,
};

export function normalizeAppLanguage(raw: unknown): AppLanguage {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'en' || s === 'english' || s === 'en-us') return 'en';
  return 'it';
}
