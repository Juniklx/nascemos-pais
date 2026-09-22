import {
  Injectable,
  inject,
  signal,
} from '@angular/core';

import type {
  Diaper,
  DiaperType,
} from '../models/diaper';

import {
  ActivityPersistenceService,
} from './activity-persistence';

@Injectable({
  providedIn: 'root',
})
export class DiaperService {
  private readonly persistence =
    inject(
      ActivityPersistenceService,
    );

  private readonly savingState =
    signal(false);

  readonly diapers =
    this.persistence.diapers;

  readonly storageError =
    this.persistence.error;

  readonly isReady =
    this.persistence.isReady;

  readonly isLoading =
    this.persistence.isLoading;

  readonly isSaving =
    this.savingState.asReadonly();

  ensureLoaded():
    Promise<void> {
    return this.persistence
      .load()
      .then(() => undefined);
  }

  async register(
    type: DiaperType,
  ): Promise<Diaper | null> {
    if (
      !(await this.prepareWrite())
    ) {
      return null;
    }

    if (this.savingState()) {
      return null;
    }

    const diaper:
      Diaper = {
        id:
          crypto.randomUUID(),

        type,

        recordedAt:
          Date.now(),
      };

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveDiaper(
          diaper,
        );

      return diaper;
    } catch {
      return null;
    } finally {
      this.savingState.set(
        false,
      );
    }
  }

  label(
    type: DiaperType,
  ): string {
    switch (type) {
      case 'wet':
        return 'Molhada';

      case 'dirty':
        return 'Suja';

      case 'both':
        return 'Ambas';
    }
  }

  async update(
    record: Diaper,
  ): Promise<boolean> {
    if (
      !(await this.prepareWrite())
    ) {
      return false;
    }

    const current =
      this.diapers()
        .find(
          (diaper) =>
            diaper.id ===
            record.id,
        );

    if (!current) {
      return false;
    }

    let validated:
      Diaper;

    try {
      validated =
        this.parseDiaper(
          record,
        );
    } catch {
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
        .saveDiaper(
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

  async remove(
    id: string,
  ): Promise<boolean> {
    if (
      !(await this.prepareWrite())
    ) {
      return false;
    }

    const exists =
      this.diapers()
        .some(
          (diaper) =>
            diaper.id === id,
        );

    if (!exists) {
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
        .deleteDiaper(
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

  private parseDiaper(
    value: unknown,
  ): Diaper {
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

    const type =
      item['type'];

    const recordedAt =
      item['recordedAt'];

    if (
      typeof id !==
        'string' ||
      id.trim().length ===
        0 ||
      id.includes('/') ||
      !this.isDiaperType(
        type,
      ) ||
      !this.isTimestamp(
        recordedAt,
      )
    ) {
      throw new Error(
        'Dados de fralda inválidos.',
      );
    }

    return {
      id,
      type,
      recordedAt,
    };
  }

  private isDiaperType(
    value: unknown,
  ): value is
    DiaperType {
    return (
      value ===
        'wet' ||
      value ===
        'dirty' ||
      value ===
        'both'
    );
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