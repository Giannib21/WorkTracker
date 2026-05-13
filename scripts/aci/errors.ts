export class SessionExpiredError extends Error {
  readonly code = 'SESSION_EXPIRED' as const;

  constructor(message = 'Sessione non valida o scaduta (401/403). Riesegui scripts/aci/capture-session.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class AciApiError extends Error {
  readonly status: number;
  readonly bodySnippet: string;

  constructor(status: number, bodySnippet: string, message?: string) {
    super(message ?? `ACI API HTTP ${status}: ${bodySnippet.slice(0, 200)}`);
    this.name = 'AciApiError';
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}
