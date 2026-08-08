export type TokenRecord = {
  slug: string;
  display_code: string;
  is_reserve: boolean;
  active: boolean;
};

export function makeSlug(): string;
export function makeTokenRecords(
  mainCount?: number,
  reserveCount?: number
): TokenRecord[];
export function buildCsv(
  tokens: { display_code: string; slug: string }[],
  baseUrl: string
): string;
export function buildQrPdf(
  tokens: { display_code: string; slug: string; is_reserve?: boolean }[],
  baseUrl: string
): Promise<Uint8Array>;
