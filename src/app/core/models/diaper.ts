export type DiaperType = 'wet' | 'dirty' | 'both';

export interface Diaper {
  readonly id: string;
  readonly type: DiaperType;
  readonly recordedAt: number;
  readonly createdByUid?: string;
}