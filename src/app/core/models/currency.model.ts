export interface Currency {
  code: string;
  name: string;
  sign: string;
  rate: number;
  last_update?: string;
}
