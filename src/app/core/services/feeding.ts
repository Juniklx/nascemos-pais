import { Injectable, computed, signal } from '@angular/core';

import type { Feeding, FeedingSide } from '../models/feeding';

@Injectable({
  providedIn: 'root',
})
export class FeedingService {
  private readonly storageKey = 'nascemos-pais:feedings:v1';
  private readonly storageErrorState = signal<string | null>(null);
  private canWriteToStorage = true;

  private readonly feedingsState = signal<readonly Feeding[]>(
    this.loadFeedings(),
  );

  readonly feedings = this.feedingsState.asReadonly();

  readonly storageError = this.storageErrorState.asReadonly();

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

    this.updateFeedings(
      (feedings) => [feeding, ...feedings],
    );

    return feeding;
  }

  setSide(side: FeedingSide | null): void {
    const active = this.activeFeeding();

    if (!active) {
      return;
    }

    this.updateFeedings((feedings) =>
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
      endedAt: Math.max(
        Date.now(),
        active.startedAt,
      ),
    };

    this.updateFeedings((feedings) =>
      feedings.map((feeding) =>
        feeding.id === active.id
          ? finished
          : feeding,
      ),
    );

    return finished;
  }

  private updateFeedings(
    update: (
      current: readonly Feeding[],
    ) => readonly Feeding[],
  ): void {
    const next = update(this.feedingsState());

    this.feedingsState.set(next);

    if (!this.canWriteToStorage) {
      return;
    }

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(next),
      );

      this.storageErrorState.set(null);
    } catch {
      this.storageErrorState.set(
        'Não foi possível salvar. As alterações estão apenas nesta sessão.',
      );
    }
  }

  private loadFeedings(): readonly Feeding[] {
    try {
      const saved = localStorage.getItem(
        this.storageKey,
      );

      if (saved === null) {
        return [];
      }

      const parsed: unknown = JSON.parse(saved);

      if (
        !Array.isArray(parsed) ||
        !parsed.every((item) => this.isFeeding(item))
      ) {
        throw new Error(
          'Formato de registros inválido.',
        );
      }

      const ids = new Set(
        parsed.map((feeding) => feeding.id),
      );

      const activeCount = parsed.filter(
        (feeding) => feeding.endedAt === null,
      ).length;

      if (
        ids.size !== parsed.length ||
        activeCount > 1
      ) {
        throw new Error(
          'Registros inconsistentes.',
        );
      }

      return parsed.map(
        ({
          id,
          startedAt,
          endedAt,
          side,
        }) => ({
          id,
          startedAt,
          endedAt,
          side,
        }),
      );
    } catch {
      this.canWriteToStorage = false;

      this.storageErrorState.set(
        'Não foi possível recuperar os registros. Novos registros ficarão apenas nesta sessão.',
      );

      return [];
    }
  }

  private isFeeding(
    value: unknown,
  ): value is Feeding {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return false;
    }

    const item = value as Record<
      string,
      unknown
    >;

    const id = item['id'];
    const startedAt = item['startedAt'];
    const endedAt = item['endedAt'];
    const side = item['side'];

    return (
      typeof id === 'string' &&
      id.trim().length > 0 &&
      typeof startedAt === 'number' &&
      Number.isSafeInteger(startedAt) &&
      startedAt >= 0 &&
      startedAt <= 8_640_000_000_000_000 &&
      (
        endedAt === null ||
        (
          typeof endedAt === 'number' &&
          Number.isSafeInteger(endedAt) &&
          endedAt >= startedAt &&
          endedAt <= 8_640_000_000_000_000
        )
      ) &&
      (
        side === null ||
        side === 'left' ||
        side === 'right'
      )
    );
  }
}