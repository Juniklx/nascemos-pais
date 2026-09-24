import {
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  MAX_FEEDING_PERIODS,
  type Feeding,
  type FeedingDurations,
  type FeedingPeriod,
  type FeedingSide,
} from '../models/feeding';

import {
  ActivityPersistenceService,
} from './activity-persistence';

@Injectable({
  providedIn: 'root',
})
export class FeedingService {
  private readonly persistence =
    inject(
      ActivityPersistenceService,
    );

  private readonly savingState =
    signal(false);

  readonly feedings =
    this.persistence.feedings;

  readonly storageError =
    this.persistence.error;

  readonly isReady =
    this.persistence.isReady;

  readonly isLoading =
    this.persistence.isLoading;

  readonly isSaving =
    this.savingState.asReadonly();

  readonly activeFeeding =
    computed(
      () =>
        this.feedings()
          .find(
            (feeding) =>
              feeding.endedAt ===
              null,
          ) ?? null,
    );

  readonly periodLimitReached = computed(
    () => (this.activeFeeding()?.periods?.length ?? 0) >= MAX_FEEDING_PERIODS,
  );

  readonly legacyOversized = computed(
    () => (this.activeFeeding()?.periods?.length ?? 0) > MAX_FEEDING_PERIODS,
  );

  readonly completedFeedings =
    computed(
      () =>
        this.feedings()
          .filter(
            (feeding) =>
              feeding.endedAt !==
              null,
          ),
    );

  ensureLoaded():
    Promise<void> {
    return this.persistence
      .load()
      .then(() => undefined);
  }

  async registerBottle(volumeMl: number, recordedAt: number): Promise<Feeding | null> {
    if (!Number.isSafeInteger(volumeMl) || volumeMl < 1 || volumeMl > 1000 ||
      !Number.isSafeInteger(recordedAt) || recordedAt < 0 || recordedAt > Date.now() ||
      !(await this.prepareWrite()) || this.savingState()) {
      return null;
    }

    if (this.feedings().some((feeding) => feeding.bottleMl === volumeMl &&
      Math.abs(feeding.startedAt - recordedAt) < 120_000)) {
      return null;
    }

    const bottle: Feeding = {
      id: crypto.randomUUID(),
      startedAt: recordedAt,
      endedAt: recordedAt,
      side: null,
      periods: null,
      bottleMl: volumeMl,
    };

    this.savingState.set(true);

    try {
      await this.persistence.saveFeeding(bottle);
      return bottle;
    } catch {
      return null;
    } finally {
      this.savingState.set(false);
    }
  }

  async start():
    Promise<Feeding | null> {
    if (
      !(await this.prepareWrite())
    ) {
      return null;
    }

    const active =
      this.activeFeeding();

    if (active) {
      return active;
    }

    if (this.savingState()) {
      return null;
    }

    const startedAt =
      Date.now();

    const feeding:
      Feeding = {
        id:
          crypto.randomUUID(),

        startedAt,

        endedAt:
          null,

        side:
          null,

        periods: [
          {
            startedAt,

            endedAt:
              null,

            side:
              null,
          },
        ],
      };

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveFeeding(
          feeding,
        );

      return feeding;
    } catch {
      return null;
    } finally {
      this.savingState.set(
        false,
      );
    }
  }

  async setSide(
    side:
      FeedingSide | null,
  ): Promise<boolean> {
    if (
      !(await this.prepareWrite())
    ) {
      return false;
    }

    const active =
      this.activeFeeding();

    if (!active) {
      return false;
    }

    const periods =
      active.periods ?? [];

    const lastPeriod =
      periods[
        periods.length - 1
      ];

    if (
      lastPeriod &&
      lastPeriod.side === side
    ) {
      return true;
    }

    // As Firestore Rules validam cada posição até este limite.
    // Preservamos a mamada em andamento e permitimos finalizá-la.
    if (periods.length >= MAX_FEEDING_PERIODS) {
      return false;
    }

    if (this.savingState()) {
      return false;
    }

    const changedAt =
      Math.max(
        Date.now(),

        lastPeriod
          ?.startedAt ??
          active.startedAt,
      );

    const nextPeriods:
      FeedingPeriod[] =
        periods.map(
          (
            period,
            index,
          ) =>
            index ===
            periods.length - 1
              ? {
                  ...period,

                  endedAt:
                    changedAt,
                }
              : period,
        );

    nextPeriods.push({
      startedAt:
        changedAt,

      endedAt:
        null,

      side,
    });

    const updated:
      Feeding = {
        ...active,

        side,

        periods:
          nextPeriods,
      };

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveFeeding(
          updated,
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

  async finish():
    Promise<Feeding | null> {
    if (
      !(await this.prepareWrite())
    ) {
      return null;
    }

    const active =
      this.activeFeeding();

    if (!active || (active.periods?.length ?? 0) > MAX_FEEDING_PERIODS) {
      // Não regravar, truncar ou tentar finalizar registros antigos maiores
      // do que o formato atualmente autorizado pelas Firestore Rules.
      return null;
    }

    if (this.savingState()) {
      return null;
    }

    const periods =
      active.periods;

    const lastPeriod =
      periods?.[
        periods.length - 1
      ];

    const endedAt =
      Math.max(
        Date.now(),

        lastPeriod
          ?.startedAt ??
          active.startedAt,
      );

    const finished:
      Feeding = {
        ...active,

        endedAt,

        periods:
          periods === null
            ? null
            : periods.map(
                (
                  period,
                  index,
                ) =>
                  index ===
                  periods.length -
                    1
                    ? {
                        ...period,

                        endedAt,
                      }
                    : period,
              ),
      };

    this.savingState.set(
      true,
    );

    try {
      await this.persistence
        .saveFeeding(
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
    record: Feeding,
  ): Promise<boolean> {
    if (
      !(await this.prepareWrite())
    ) {
      return false;
    }

    const current =
      this.feedings()
        .find(
          (feeding) =>
            feeding.id ===
            record.id,
        );

    if (
      !current ||
      current.endedAt === null ||
      (current.periods?.length ?? 0) > MAX_FEEDING_PERIODS ||
      (record.periods?.length ?? 0) > MAX_FEEDING_PERIODS
    ) {
      return false;
    }

    let validated:
      Feeding;

    try {
      validated =
        this.parseFeeding(
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
        .saveFeeding(
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
      this.feedings()
        .find(
          (feeding) =>
            feeding.id === id,
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
        .deleteFeeding(
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

  durations(
    feeding: Feeding,
    now = Date.now(),
  ): FeedingDurations {
    const periods =
      feeding.periods ?? [];

    const lastPeriod =
      periods[
        periods.length - 1
      ];

    const end =
      feeding.endedAt ??
      Math.max(
        now,

        lastPeriod
          ?.startedAt ??
          feeding.startedAt,
      );

    let left = 0;
    let right = 0;
    let unspecified = 0;

    for (
      const period of periods
    ) {
      const duration =
        Math.max(
          0,

          (
            period.endedAt ??
            end
          ) -
            period.startedAt,
        );

      if (
        period.side ===
        'left'
      ) {
        left += duration;
      } else if (
        period.side ===
        'right'
      ) {
        right += duration;
      } else {
        unspecified +=
          duration;
      }
    }

    const total =
      Math.max(
        0,

        end -
          feeding.startedAt,
      );

    return {
      total,
      left,
      right,
      unspecified,

      untracked:
        Math.max(
          0,

          total -
            left -
            right -
            unspecified,
        ),
    };
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

  private parseFeeding(
    value: unknown,
  ): Feeding {
    if (
      !this.isObject(
        value,
      )
    ) {
      throw new Error(
        'Registro inválido.',
      );
    }

    const id =
      value['id'];

    const startedAt =
      value['startedAt'];

    const endedAt =
      value['endedAt'];

    const side =
      value['side'];

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
      ) ||
      !this.isSide(
        side,
      )
    ) {
      throw new Error(
        'Dados da mamada inválidos.',
      );
    }

    const base = {
      id,
      startedAt,
      endedAt,
      side,
    };

    const rawPeriods =
      value['periods'];

    const bottleMl = value['bottleMl'];

    if (bottleMl !== undefined) {
      if (!Number.isSafeInteger(bottleMl) || (bottleMl as number) < 1 ||
        (bottleMl as number) > 1000 || endedAt !== startedAt || side !== null ||
        rawPeriods !== null) {
        throw new Error('Dados da mamadeira inválidos.');
      }

      return { ...base, periods: null, bottleMl: bottleMl as number };
    }

    if (
      rawPeriods ===
      null
    ) {
      return {
        ...base,
        periods: null,
      };
    }

    if (
      !Array.isArray(
        rawPeriods,
      ) ||
      rawPeriods.length ===
        0
    ) {
      throw new Error(
        'Períodos inválidos.',
      );
    }

    const periods:
      FeedingPeriod[] = [];

    let previousEnd =
      startedAt;

    for (
      let index = 0;
      index <
      rawPeriods.length;
      index++
    ) {
      const raw:
        unknown =
          rawPeriods[
            index
          ];

      if (
        !this.isObject(
          raw,
        )
      ) {
        throw new Error(
          'Período inválido.',
        );
      }

      const periodStart =
        raw[
          'startedAt'
        ];

      const periodEnd =
        raw[
          'endedAt'
        ];

      const periodSide =
        raw[
          'side'
        ];

      const isLast =
        index ===
        rawPeriods.length -
          1;

      if (
        !this.isTimestamp(
          periodStart,
        ) ||
        periodStart <
          startedAt ||
        !this.isSide(
          periodSide,
        ) ||
        !(
          periodEnd ===
            null ||
          (
            this.isTimestamp(
              periodEnd,
            ) &&
            periodEnd >=
              periodStart
          )
        )
      ) {
        throw new Error(
          'Dados do período inválidos.',
        );
      }

      if (
        index > 0 &&
        periodStart !==
          previousEnd
      ) {
        throw new Error(
          'Períodos descontínuos.',
        );
      }

      if (
        !isLast &&
        periodEnd ===
          null
      ) {
        throw new Error(
          'Período aberto antes do último.',
        );
      }

      if (
        isLast &&
        (
          periodEnd !==
            endedAt ||
          periodSide !==
            side
        )
      ) {
        throw new Error(
          'Último período inconsistente.',
        );
      }

      periods.push({
        startedAt:
          periodStart,

        endedAt:
          periodEnd,

        side:
          periodSide,
      });

      previousEnd =
        periodEnd ??
        periodStart;
    }

    return {
      ...base,
      periods,
    };
  }

  private isObject(
    value: unknown,
  ): value is Record<
    string,
    unknown
  > {
    return (
      typeof value ===
        'object' &&
      value !== null &&
      !Array.isArray(
        value,
      )
    );
  }

  private isSide(
    value: unknown,
  ): value is
    FeedingSide | null {
    return (
      value === null ||
      value ===
        'left' ||
      value ===
        'right'
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
