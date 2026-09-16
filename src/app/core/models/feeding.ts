export type FeedingSide = 'left' | 'right';

export interface Feeding {
  readonly id: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly side: FeedingSide | null;
}