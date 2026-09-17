import { Injectable, signal } from '@angular/core';

import type {
  Diaper,
  DiaperType,
} from '../models/diaper';

@Injectable({
  providedIn: 'root',
})
export class DiaperService {
  private readonly storageKey = 'nascemos-pais:diapers:v1';
  private readonly storageErrorState = signal<string | null>(null);
  private canWriteToStorage = true;

  private readonly diapersState = signal<readonly Diaper[]>(
    this.loadDiapers(),
  );

  readonly diapers = this.diapersState.asReadonly();
  readonly storageError = this.storageErrorState.asReadonly();

  register(type: DiaperType): Diaper {
    const diaper: Diaper = {
      id: crypto.randomUUID(),
      type,
      recordedAt: Date.now(),
    };

    this.updateDiapers((diapers) => [
      diaper,
      ...diapers,
    ]);

    return diaper;
  }

  label(type: DiaperType): string {
    switch (type) {
      case 'wet':
        return 'Molhada';
      case 'dirty':
        return 'Suja';
      case 'both':
        return 'Ambas';
    }
  }

    private updateDiapers(
    update: (current: readonly Diaper[]) => readonly Diaper[],
  ): void {
    const requested = update(this.diapersState());
    const stored = this.readStoredDiapers();

    const storedIds = new Set(
      stored.map((diaper) => diaper.id),
    );

    const newDiapers = requested.filter(
      (diaper) => !storedIds.has(diaper.id),
    );

    const merged = [
      ...stored,
      ...newDiapers,
    ].sort(
      (a, b) => b.recordedAt - a.recordedAt,
    );

    this.diapersState.set(merged);

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
        'Não foi possível salvar. O registro está apenas nesta sessão.',
      );
    }
  }

    private readStoredDiapers(): Diaper[] {
    try {
      const saved = localStorage.getItem(
        this.storageKey,
      );

      if (saved === null) {
        return [...this.diapersState()];
      }

      const parsed: unknown = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        return [...this.diapersState()];
      }

      return parsed.map((item: unknown) =>
        this.parseDiaper(item),
      );
    } catch {
      return [...this.diapersState()];
    }
  }

  private loadDiapers(): readonly Diaper[] {
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

      return parsed.map((item: unknown) =>
        this.parseDiaper(item),
      );
    } catch {
      this.canWriteToStorage = false;

      this.storageErrorState.set(
        'Não foi possível recuperar os registros de fralda.',
      );

      return [];
    }
  }

  private parseDiaper(value: unknown): Diaper {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error('Registro inválido.');
    }

    const item = value as Record<string, unknown>;
    const id = item['id'];
    const type = item['type'];
    const recordedAt = item['recordedAt'];

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      !this.isDiaperType(type) ||
      !this.isTimestamp(recordedAt)
    ) {
      throw new Error('Dados de fralda inválidos.');
    }

    return {
      id,
      type,
      recordedAt,
    };
  }

  private isDiaperType(
    value: unknown,
  ): value is DiaperType {
    return (
      value === 'wet' ||
      value === 'dirty' ||
      value === 'both'
    );
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