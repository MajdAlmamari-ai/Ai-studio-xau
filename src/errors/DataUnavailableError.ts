export class DataUnavailableError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[DataUnavailable] ${code}: ${message}`);
    this.name = 'DataUnavailableError';
  }
}
