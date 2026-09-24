import {
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import type {
  Sleep,
} from '../models/sleep';

import {
  ActivityPersistenceService,
} from './activity-persistence';

@Injectable({
  providedIn: 'root',
})
export class SleepService {
  private readonly persistence =
    inject(
      ActivityPersistenceService,
    );

  private readonly savingState =
    signal(false);

  readonly sleeps =
    this.persistence.sleeps;

  readonly storageError =
    this.persistence.error;

  readonly isReady =
    this.persistence.isReady;

  readonly isLoading =
    this.persistence.isLoading;

  readonly isSaving =
    this.savingState.asReadonly();

  readonly activeSleep =
    computed(
      () =>
        this.sleeps()
          .find(
            (sleep) =>
              sleep.endedAt ===
              null,
          ) ?? null,
    );

  readonly completedSleeps =
    computed(
      () =>
        this.sleeps()
          .filter(
            (sleep) =>
              sleep.endedAt !==
              null,
          ),
    );

  ensureLoaded():
    Promise<void> {
    return this.persistence
      .load()
      .then(() => undefined);
  }

  async start():
    Promise<Sleep | null> {
    return this.startAt(Date.now(), true);
  }

  async startAt(startedAt: number, reuseActive = false): Promise<Sleep | null> {
    if (!Number.isSafeInteger(startedAt) || startedAt < 0 || startedAt > Date.now()) {
      return null;
    }

    if (
      !(await this.prepareWrite())
    ) {
      return null;
    }

    const active =
      this.activeSleep();

    if (active) {
      return reuseActive ? active : null;
    }

    if (this.savingState()) {
      return null;
    }

    const sleep: Sleep = {
      id:
        crypto.randomUUID(),

      startedAt:
        startedAt,

      endedAt:
        null,
    };

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveSleep(
          sleep,
        );

      return sleep;
    } catch {
      return null;
    } finally {
      this.savingState.set(
        false,
      );
    }
  }

  async finish():
    Promise<Sleep | null> {
    if (
      !(await this.prepareWrite())
    ) {
      return null;
    }

    const active =
      this.activeSleep();

    if (!active) {
      return null;
    }

    if (this.savingState()) {
      return null;
    }

    const finished:
      Sleep = {
        ...active,

        endedAt:
          Math.max(
            Date.now(),
            active.startedAt,
          ),
      };

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveSleep(
          finished,
        );

      return finished;
    } catch {
      return null;
    } finally {
      this.savingState.set(
        false,
      );
    }
  }

  async updateCompleted(
    record: Sleep,
  ): Promise<boolean> {
    if (
      !(await this.prepareWrite())
    ) {
      return false;
    }

    const current =
      this.sleeps()
        .find(
          (sleep) =>
            sleep.id ===
            record.id,
        );

    if (
      !current ||
      current.endedAt === null
    ) {
      return false;
    }

    let validated:
      Sleep;

    try {
      validated =
        this.parseSleep(
          record,
        );
    } catch {
      return false;
    }

    if (
      validated.endedAt ===
      null
    ) {
      return false;
    }

    if (this.savingState()) {
      return false;
    }

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveSleep(
          validated,
        );

      return true;
    } catch {
      return false;
    } finally {
      this.savingState.set(
        false,
      );
    }
  }

  async removeCompleted(
    id: string,
  ): Promise<boolean> {
    if (
      !(await this.prepareWrite())
    ) {
      return false;
    }

    const record =
      this.sleeps()
        .find(
          (sleep) =>
            sleep.id === id,
        );

    if (
      !record ||
      record.endedAt === null
    ) {
      return false;
    }

    if (this.savingState()) {
      return false;
    }

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .deleteSleep(
          id,
        );

      return true;
    } catch {
      return false;
    } finally {
      this.savingState.set(
        false,
      );
    }
  }

  duration(
    sleep: Sleep,
    now = Date.now(),
  ): number {
    return Math.max(
      0,

      (
        sleep.endedAt ??
        now
      ) -
        sleep.startedAt,
    );
  }

  private async prepareWrite():
    Promise<boolean> {
    try {
      await this.ensureLoaded();

      return (
        this.persistence
          .isReady()
      );
    } catch {
      return false;
    }
  }

  private parseSleep(
    value: unknown,
  ): Sleep {
    if (
      typeof value !==
        'object' ||
      value === null ||
      Array.isArray(
        value,
      )
    ) {
      throw new Error(
        'Registro inválido.',
      );
    }

    const item =
      value as Record<
        string,
        unknown
      >;

    const id =
      item['id'];

    const startedAt =
      item['startedAt'];

    const endedAt =
      item['endedAt'];

    if (
      typeof id !==
        'string' ||
      id.trim().length ===
        0 ||
      id.includes('/') ||
      !this.isTimestamp(
        startedAt,
      ) ||
      !(
        endedAt === null ||
        (
          this.isTimestamp(
            endedAt,
          ) &&
          endedAt >=
            startedAt
        )
      )
    ) {
      throw new Error(
        'Dados de sono inválidos.',
      );
    }

    return {
      id,
      startedAt,
      endedAt,
    };
  }

  private isTimestamp(
    value: unknown,
  ): value is number {
    return (
      typeof value ===
        'number' &&
      Number.isSafeInteger(
        value,
      ) &&
      value >= 0 &&
      value <=
        8_640_000_000_000_000
    );
  }
}
