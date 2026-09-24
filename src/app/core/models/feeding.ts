export const MAX_FEEDING_PERIODS = 6;

export type FeedingSide = 'left' | 'right';

export interface FeedingPeriod {
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly side: FeedingSide | null;
}

export interface Feeding {
  readonly id: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly side: FeedingSide | null;

  // null identifica registros antigos, sem períodos registrados.
  readonly periods: readonly FeedingPeriod[] | null;
  readonly bottleMl?: number;
  readonly createdByUid?: string;
  readonly finishedByUid?: string;
}

export interface FeedingDurations {
  readonly total: number;
  readonly left: number;
  readonly right: number;
  readonly unspecified: number;
  readonly untracked: number;
}
