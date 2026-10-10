declare module '@adobe/structured-data-validator' {
  export class Validator {
    constructor(schema: unknown);
    validate(data: unknown): Promise<{ issueMessage: string; severity: string; path?: { type?: string }[] }[]>;
  }
}
