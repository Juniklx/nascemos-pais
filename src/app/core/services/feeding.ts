import { Injectable, computed, signal } from '@angular/core';

import type { Feeding, FeedingSide } from '../models/feeding';

@Injectable({
  providedIn: 'root',
})
export class FeedingService {
  private readonly feedingsState = signal<readonly Feeding[]>([]);

  readonly feedings = this.feedingsState.asReadonly();

  readonly activeFeeding = computed(
    () =>
      this.feedingsState().find(
        (feeding) => feeding.endedAt === null,
      ) ?? null,
  );

  readonly completedFeedings = computed<readonly Feeding[]>(
    () =>
      this.feedingsState().filter(
        (feeding) => feeding.endedAt !== null,
      ),
  );

  start(): Feeding {
    const active = this.activeFeeding();

    if (active) {
      return active;
    }

    const feeding: Feeding = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      endedAt: null,
      side: null,
    };

    this.feedingsState.update(
      (feedings) => [feeding, ...feedings],
    );

    return feeding;
  }

  setSide(side: FeedingSide | null): void {
    const active = this.activeFeeding();

    if (!active) {
      return;
    }

    this.feedingsState.update((feedings) =>
      feedings.map((feeding) =>
        feeding.id === active.id
          ? { ...feeding, side }
          : feeding,
      ),
    );
  }

  finish(): Feeding | null {
    const active = this.activeFeeding();

    if (!active) {
      return null;
    }

    const finished: Feeding = {
      ...active,
      endedAt: Math.max(Date.now(), active.startedAt),
    };

    this.feedingsState.update((feedings) =>
      feedings.map((feeding) =>
        feeding.id === active.id ? finished : feeding,
      ),
    );

    return finished;
  }
}