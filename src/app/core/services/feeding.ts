import { Injectable, computed, signal } from '@angular/core';

import type {
  Feeding,
  FeedingDurations,
  FeedingPeriod,
  FeedingSide,
} from '../models/feeding';

@Injectable({
  providedIn: 'root',
})
export class FeedingService {
  private readonly storageKey = 'nascemos-pais:feedings:v2';
  private readonly legacyStorageKey = 'nascemos-pais:feedings:v1';

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

  readonly completedFeedings = computed(() =>
    this.feedingsState().filter(
      (feeding) => feeding.endedAt !== null,
    ),
  );

  start(): Feeding {
    const active = this.activeFeeding();

    if (active) {
      return active;
    }

    const startedAt = Date.now();

    const feeding: Feeding = {
      id: crypto.randomUUID(),
      startedAt,
      endedAt: null,
      side: null,
      periods: [
        {
          startedAt,
          endedAt: null,
          side: null,
        },
      ],
    };

    this.updateFeedings((feedings) => [
      feeding,
      ...feedings,
    ]);

    return feeding;
  }

  setSide(side: FeedingSide | null): void {
    const active = this.activeFeeding();

    if (!active) {
      return;
    }

    const periods = active.periods ?? [];
    const lastPeriod = periods[periods.length - 1];

    // Clicar novamente no lado atual não reinicia seu período.
    if (lastPeriod && lastPeriod.side === side) {
      return;
    }

    const changedAt = Math.max(
      Date.now(),
      lastPeriod?.startedAt ?? active.startedAt,
    );

    const nextPeriods: FeedingPeriod[] = periods.map(
      (period, index) =>
        index === periods.length - 1
          ? { ...period, endedAt: changedAt }
          : period,
    );

    nextPeriods.push({
      startedAt: changedAt,
      endedAt: null,
      side,
    });

    const updated: Feeding = {
      ...active,
      side,
      periods: nextPeriods,
    };

    this.updateFeedings((feedings) =>
      feedings.map((feeding) =>
        feeding.id === active.id ? updated : feeding,
      ),
    );
  }

  finish(): Feeding | null {
    const active = this.activeFeeding();

    if (!active) {
      return null;
    }

    const periods = active.periods;
    const lastPeriod = periods?.[periods.length - 1];

    const endedAt = Math.max(
      Date.now(),
      lastPeriod?.startedAt ?? active.startedAt,
    );

    const finished: Feeding = {
      ...active,
      endedAt,
      periods:
        periods === null
          ? null
          : periods.map((period, index) =>
            index === periods.length - 1
              ? { ...period, endedAt }
              : period,
          ),
    };

    this.updateFeedings((feedings) =>
      feedings.map((feeding) =>
        feeding.id === active.id ? finished : feeding,
      ),
    );

    return finished;
  }

  updateCompleted(record: Feeding): boolean {
    const current = this.feedingsState().find(
      (feeding) => feeding.id === record.id,
    );

    if (!current || current.endedAt === null) {
      return false;
    }

    let validated: Feeding;

    try {
      validated = this.parseFeeding(record, false);
    } catch {
      return false;
    }

    if (validated.endedAt === null) {
      return false;
    }

    this.updateFeedings((feedings) =>
      feedings.map((feeding) =>
        feeding.id === validated.id
          ? validated
          : feeding,
      ),
    );

    return true;
  }

  removeCompleted(id: string): boolean {
    const record = this.feedingsState().find(
      (feeding) => feeding.id === id,
    );

    if (!record || record.endedAt === null) {
      return false;
    }

    this.updateFeedings((feedings) =>
      feedings.filter((feeding) => feeding.id !== id),
    );

    return true;
  }

  durations(
    feeding: Feeding,
    now = Date.now(),
  ): FeedingDurations {
    const periods = feeding.periods ?? [];
    const lastPeriod = periods[periods.length - 1];

    const end =
      feeding.endedAt ??
      Math.max(
        now,
        lastPeriod?.startedAt ?? feeding.startedAt,
      );

    let left = 0;
    let right = 0;
    let unspecified = 0;

    for (const period of periods) {
      const duration = Math.max(
        0,
        (period.endedAt ?? end) - period.startedAt,
      );

      if (period.side === 'left') {
        left += duration;
      } else if (period.side === 'right') {
        right += duration;
      } else {
        unspecified += duration;
      }
    }

    const total = Math.max(0, end - feeding.startedAt);

    return {
      total,
      left,
      right,
      unspecified,
      untracked: Math.max(
        0,
        total - left - right - unspecified,
      ),
    };
  }

  private readStoredFeedings(): Feeding[] {
    try {
      const saved = localStorage.getItem(
        this.storageKey,
      );

      if (saved === null) {
        return [...this.feedingsState()];
      }

      const parsed: unknown = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        return [...this.feedingsState()];
      }

      return parsed.map((item: unknown) =>
        this.parseFeeding(item, false),
      );
    } catch {
      // Se o armazenamento estiver inválido, preserva
      // a lista atual e deixa loadFeedings() controlar
      // a mensagem de erro.
      return [...this.feedingsState()];
    }
  }

  private updateFeedings(
    update: (current: readonly Feeding[]) => readonly Feeding[],
  ): void {
    const previous = this.feedingsState();
    const requested = update(previous);

    const stored = this.readStoredFeedings();
    const changedIds = new Set<string>();
    const removedIds = new Set(
      previous
        .filter(
          (previousFeeding) =>
            !requested.some(
              (feeding) =>
                feeding.id === previousFeeding.id,
            ),
        )
        .map((feeding) => feeding.id),
    );

    for (const feeding of requested) {
      const previousFeeding = previous.find(
        (item) => item.id === feeding.id,
      );

      if (
        previousFeeding === undefined ||
        JSON.stringify(previousFeeding) !==
        JSON.stringify(feeding)
      ) {
        changedIds.add(feeding.id);
      }
    }

    const merged = stored.filter(
      (feeding) =>
        !changedIds.has(feeding.id) &&
        !removedIds.has(feeding.id),
    );

    for (const feeding of requested) {
      if (changedIds.has(feeding.id)) {
        merged.push(feeding);
      }
    }

    // Ordena do mais recente para o mais antigo.
    merged.sort((a, b) => b.startedAt - a.startedAt);

    this.feedingsState.set(merged);

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

  private loadFeedings(): readonly Feeding[] {
    try {
      const current = localStorage.getItem(this.storageKey);

      const saved =
        current ??
        localStorage.getItem(this.legacyStorageKey);

      if (saved === null) {
        return [];
      }

      const parsed: unknown = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        throw new Error('Formato de registros inválido.');
      }

      const feedings = parsed.map((item: unknown) =>
        this.parseFeeding(item, current === null),
      );

      const ids = new Set(
        feedings.map((feeding) => feeding.id),
      );

      const activeCount = feedings.filter(
        (feeding) => feeding.endedAt === null,
      ).length;

      if (
        ids.size !== feedings.length ||
        activeCount > 1
      ) {
        throw new Error('Registros inconsistentes.');
      }

      return feedings;
    } catch {
      this.canWriteToStorage = false;

      this.storageErrorState.set(
        'Não foi possível recuperar os registros. Novos registros ficarão apenas nesta sessão.',
      );

      return [];
    }
  }

  private parseFeeding(
    value: unknown,
    legacy: boolean,
  ): Feeding {
    if (!this.isObject(value)) {
      throw new Error('Registro inválido.');
    }

    const id = value['id'];
    const startedAt = value['startedAt'];
    const endedAt = value['endedAt'];
    const side = value['side'];

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      !this.isTimestamp(startedAt) ||
      !(
        endedAt === null ||
        (this.isTimestamp(endedAt) && endedAt >= startedAt)
      ) ||
      !this.isSide(side)
    ) {
      throw new Error('Dados da mamada inválidos.');
    }

    const base = { id, startedAt, endedAt, side };

    // A versão antiga não registrava as trocas de lado.
    if (legacy || value['periods'] === null) {
      return { ...base, periods: null };
    }

    const rawPeriods = value['periods'];

    if (
      !Array.isArray(rawPeriods) ||
      rawPeriods.length === 0
    ) {
      throw new Error('Períodos inválidos.');
    }

    const periods: FeedingPeriod[] = [];
    let previousEnd = startedAt;

    for (let index = 0; index < rawPeriods.length; index++) {
      const raw: unknown = rawPeriods[index];

      if (!this.isObject(raw)) {
        throw new Error('Período inválido.');
      }

      const periodStart = raw['startedAt'];
      const periodEnd = raw['endedAt'];
      const periodSide = raw['side'];
      const isLast = index === rawPeriods.length - 1;

      if (
        !this.isTimestamp(periodStart) ||
        periodStart < startedAt ||
        !this.isSide(periodSide) ||
        !(
          periodEnd === null ||
          (
            this.isTimestamp(periodEnd) &&
            periodEnd >= periodStart
          )
        )
      ) {
        throw new Error('Dados do período inválidos.');
      }

      // O primeiro período pode começar depois do início
      // quando a mamada já estava ativa na versão antiga.
      if (index > 0 && periodStart !== previousEnd) {
        throw new Error('Períodos descontínuos.');
      }

      if (!isLast && periodEnd === null) {
        throw new Error('Período aberto antes do último.');
      }

      if (
        isLast &&
        (periodEnd !== endedAt || periodSide !== side)
      ) {
        throw new Error('Último período inconsistente.');
      }

      periods.push({
        startedAt: periodStart,
        endedAt: periodEnd,
        side: periodSide,
      });

      previousEnd = periodEnd ?? periodStart;
    }

    return { ...base, periods };
  }

  private isObject(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  private isSide(
    value: unknown,
  ): value is FeedingSide | null {
    return (
      value === null ||
      value === 'left' ||
      value === 'right'
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