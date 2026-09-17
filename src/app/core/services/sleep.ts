import { Injectable, computed, signal } from '@angular/core';

import type { Sleep } from '../models/sleep';

@Injectable({
  providedIn: 'root',
})
export class SleepService {
  private readonly storageKey = 'nascemos-pais:sleeps:v1';
  private readonly storageErrorState = signal<string | null>(null);
  private canWriteToStorage = true;

  private readonly sleepsState = signal<readonly Sleep[]>(
    this.loadSleeps(),
  );

  readonly sleeps = this.sleepsState.asReadonly();
  readonly storageError = this.storageErrorState.asReadonly();

  readonly activeSleep = computed(
    () =>
      this.sleepsState().find(
        (sleep) => sleep.endedAt === null,
      ) ?? null,
  );

  readonly completedSleeps = computed(() =>
    this.sleepsState().filter(
      (sleep) => sleep.endedAt !== null,
    ),
  );

  start(): Sleep {
    const active = this.activeSleep();

    if (active) {
      return active;
    }

    const sleep: Sleep = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      endedAt: null,
    };

    this.updateSleeps((sleeps) => [
      sleep,
      ...sleeps,
    ]);

    return sleep;
  }

  finish(): Sleep | null {
    const active = this.activeSleep();

    if (!active) {
      return null;
    }

    const finished: Sleep = {
      ...active,
      endedAt: Math.max(Date.now(), active.startedAt),
    };

    this.updateSleeps((sleeps) =>
      sleeps.map((sleep) =>
        sleep.id === active.id ? finished : sleep,
      ),
    );

    return finished;
  }

  updateCompleted(record: Sleep): boolean {
    const current = this.sleepsState().find(
      (sleep) => sleep.id === record.id,
    );

    if (!current || current.endedAt === null) {
      return false;
    }

    let validated: Sleep;

    try {
      validated = this.parseSleep(record);
    } catch {
      return false;
    }

    if (validated.endedAt === null) {
      return false;
    }

    this.updateSleeps((sleeps) =>
      sleeps.map((sleep) =>
        sleep.id === validated.id
          ? validated
          : sleep,
      ),
    );

    return true;
  }

  removeCompleted(id: string): boolean {
    const record = this.sleepsState().find(
      (sleep) => sleep.id === id,
    );

    if (!record || record.endedAt === null) {
      return false;
    }

    this.updateSleeps((sleeps) =>
      sleeps.filter((sleep) => sleep.id !== id),
    );

    return true;
  }

  duration(
    sleep: Sleep,
    now = Date.now(),
  ): number {
    return Math.max(
      0,
      (sleep.endedAt ?? now) - sleep.startedAt,
    );
  }

  private updateSleeps(
    update: (current: readonly Sleep[]) => readonly Sleep[],
  ): void {
    const previous = this.sleepsState();
    const requested = update(previous);
    const stored = this.readStoredSleeps();

    const changedIds = new Set<string>();

    const removedIds = new Set(
      previous
        .filter(
          (previousSleep) =>
            !requested.some(
              (sleep) => sleep.id === previousSleep.id,
            ),
        )
        .map((sleep) => sleep.id),
    );

    for (const sleep of requested) {
      const previousSleep = previous.find(
        (item) => item.id === sleep.id,
      );

      if (
        previousSleep === undefined ||
        JSON.stringify(previousSleep) !==
        JSON.stringify(sleep)
      ) {
        changedIds.add(sleep.id);
      }
    }

    const merged = stored.filter(
      (sleep) =>
        !changedIds.has(sleep.id) &&
        !removedIds.has(sleep.id),
    );

    for (const sleep of requested) {
      if (changedIds.has(sleep.id)) {
        merged.push(sleep);
      }
    }

    merged.sort((a, b) => b.startedAt - a.startedAt);
    this.sleepsState.set(merged);

    if (!this.canWriteToStorage) {
      return;
    }

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(merged),
      );

      this.storageErrorState.set(null);
    } catch {
      this.storageErrorState.set(
        'Não foi possível salvar. As alterações estão apenas nesta sessão.',
      );
    }
  }

  private readStoredSleeps(): Sleep[] {
    try {
      const saved = localStorage.getItem(
        this.storageKey,
      );

      if (saved === null) {
        return [...this.sleepsState()];
      }

      const parsed: unknown = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        return [...this.sleepsState()];
      }

      return parsed.map((item: unknown) =>
        this.parseSleep(item),
      );
    } catch {
      return [...this.sleepsState()];
    }
  }

  private loadSleeps(): readonly Sleep[] {
    try {
      const saved = localStorage.getItem(
        this.storageKey,
      );

      if (saved === null) {
        return [];
      }

      const parsed: unknown = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        throw new Error('Formato inválido.');
      }

      const sleeps = parsed.map((item: unknown) =>
        this.parseSleep(item),
      );

      const ids = new Set(
        sleeps.map((sleep) => sleep.id),
      );

      const activeCount = sleeps.filter(
        (sleep) => sleep.endedAt === null,
      ).length;

      if (
        ids.size !== sleeps.length ||
        activeCount > 1
      ) {
        throw new Error('Registros inconsistentes.');
      }

      return sleeps;
    } catch {
      this.canWriteToStorage = false;

      this.storageErrorState.set(
        'Não foi possível recuperar os registros de sono. Novos registros ficarão apenas nesta sessão.',
      );

      return [];
    }
  }

  private parseSleep(value: unknown): Sleep {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error('Registro inválido.');
    }

    const item = value as Record<string, unknown>;
    const id = item['id'];
    const startedAt = item['startedAt'];
    const endedAt = item['endedAt'];

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      !this.isTimestamp(startedAt) ||
      !(
        endedAt === null ||
        (
          this.isTimestamp(endedAt) &&
          endedAt >= startedAt
        )
      )
    ) {
      throw new Error('Dados de sono inválidos.');
    }

    return {
      id,
      startedAt,
      endedAt,
    };
  }

  private isTimestamp(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 8_640_000_000_000_000
    );
  }
}