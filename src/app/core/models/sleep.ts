export interface Sleep {
  readonly id: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly createdByUid?: string;
  readonly finishedByUid?: string;
}