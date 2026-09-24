import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';

import type {
  Diaper,
  DiaperType,
} from '../../../core/models/diaper';

import type {
  Feeding,
  FeedingPeriod,
  FeedingSide,
} from '../../../core/models/feeding';

import type {
  Sleep,
} from '../../../core/models/sleep';

import {
  DiaperService,
} from '../../../core/services/diaper';

import {
  FeedingService,
} from '../../../core/services/feeding';

import {
  SleepService,
} from '../../../core/services/sleep';

type HistoryActivity =
  | {
      kind: 'feeding';
      record: Feeding;
    }
  | {
      kind: 'sleep';
      record: Sleep;
    }
  | {
      kind: 'diaper';
      record: Diaper;
    };

type FeedingSideSelection =
  | 'keep'
  | 'left'
  | 'right'
  | 'none';

@Component({
  selector:
    'app-history-detail',

  imports: [
    RouterLink,
  ],

  templateUrl:
    './history-detail.html',

  styleUrl:
    './history-detail.css',
})
export class HistoryDetail {
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly feedingService =
    inject(
      FeedingService,
    );

  private readonly sleepService =
    inject(
      SleepService,
    );

  private readonly diaperService =
    inject(
      DiaperService,
    );

  private readonly router =
    inject(
      Router,
    );

  readonly confirmingDelete =
    signal(false);

  readonly deleteError =
    signal<string | null>(
      null,
    );

  readonly editing =
    signal(false);

  readonly editError =
    signal<string | null>(
      null,
    );

  readonly startedAtInput =
    signal('');

  readonly endedAtInput =
    signal('');

  readonly feedingSideInput =
    signal<FeedingSideSelection>(
      'keep',
    );

  readonly bottleMlInput = signal('');

  readonly diaperTypeInput =
    signal<DiaperType>(
      'wet',
    );

  readonly isSaving =
    computed(
      () =>
        this.feedingService
          .isSaving() ||
        this.sleepService
          .isSaving() ||
        this.diaperService
          .isSaving(),
    );

  private readonly type =
    this.route
      .snapshot
      .paramMap
      .get('type');

  private readonly id =
    this.route
      .snapshot
      .paramMap
      .get('id');

  readonly activity =
    computed<
      HistoryActivity | null
    >(
      () => {
        if (!this.id) {
          return null;
        }

        switch (
          this.type
        ) {
          case 'feeding': {
            const record =
              this.feedingService
                .feedings()
                .find(
                  (feeding) =>
                    feeding.id ===
                    this.id,
                );

            return record
              ? {
                  kind:
                    'feeding',

                  record,
                }
              : null;
          }

          case 'sleep': {
            const record =
              this.sleepService
                .sleeps()
                .find(
                  (sleep) =>
                    sleep.id ===
                    this.id,
                );

            return record
              ? {
                  kind:
                    'sleep',

                  record,
                }
              : null;
          }

          case 'diaper': {
            const record =
              this.diaperService
                .diapers()
                .find(
                  (diaper) =>
                    diaper.id ===
                    this.id,
                );

            return record
              ? {
                  kind:
                    'diaper',

                  record,
                }
              : null;
          }

          default:
            return null;
        }
      },
    );

  requestDelete(): void {
    this.deleteError.set(
      null,
    );

    this.confirmingDelete.set(
      true,
    );
  }

  cancelDelete(): void {
    this.deleteError.set(
      null,
    );

    this.confirmingDelete.set(
      false,
    );
  }

  async confirmDelete():
    Promise<void> {
    const activity =
      this.activity();

    if (!activity) {
      this.deleteError.set(
        'O registro não está mais disponível.',
      );

      return;
    }

    this.deleteError.set(
      null,
    );

    let removed =
      false;

    switch (
      activity.kind
    ) {
      case 'feeding':
        removed =
          await this.feedingService
            .removeCompleted(
              activity
                .record
                .id,
            );
        break;

      case 'sleep':
        removed =
          await this.sleepService
            .removeCompleted(
              activity
                .record
                .id,
            );
        break;

      case 'diaper':
        removed =
          await this.diaperService
            .remove(
              activity
                .record
                .id,
            );
        break;
    }

    if (!removed) {
      this.deleteError.set(
        this.syncError() ??
          'Não foi possível excluir o registro.',
      );

      return;
    }

    this.confirmingDelete.set(
      false,
    );

    await this.router.navigate([
      '/history',
    ]);
  }

  startEditing(): void {
    const activity =
      this.activity();

    if (!activity) {
      return;
    }

    this.confirmingDelete.set(
      false,
    );

    this.editError.set(
      null,
    );

    switch (
      activity.kind
    ) {
      case 'feeding':
        if (
          activity.record
            .endedAt ===
          null
        ) {
          this.editError.set(
            'Somente mamadas concluídas podem ser editadas.',
          );

          return;
        }

        this.startedAtInput.set(
          this.toDateTimeInput(
            activity.record
              .startedAt,
          ),
        );

        this.endedAtInput.set(
          this.toDateTimeInput(
            activity.record
              .endedAt,
          ),
        );

        this.feedingSideInput.set(
          'keep',
        );

        this.bottleMlInput.set(activity.record.bottleMl?.toString() ?? '');

        break;

      case 'sleep':
        if (
          activity.record
            .endedAt ===
          null
        ) {
          this.editError.set(
            'Somente períodos de sono concluídos podem ser editados.',
          );

          return;
        }

        this.startedAtInput.set(
          this.toDateTimeInput(
            activity.record
              .startedAt,
          ),
        );

        this.endedAtInput.set(
          this.toDateTimeInput(
            activity.record
              .endedAt,
          ),
        );

        break;

      case 'diaper':
        this.startedAtInput.set(
          this.toDateTimeInput(
            activity.record
              .recordedAt,
          ),
        );

        this.endedAtInput.set(
          '',
        );

        this.diaperTypeInput.set(
          activity.record
            .type,
        );

        break;
    }

    this.editing.set(
      true,
    );
  }

  cancelEditing(): void {
    this.editError.set(
      null,
    );

    this.editing.set(
      false,
    );
  }

  onStartedAtInput(
    event: Event,
  ): void {
    this.startedAtInput.set(
      this.readControlValue(
        event,
      ),
    );
  }

  onEndedAtInput(
    event: Event,
  ): void {
    this.endedAtInput.set(
      this.readControlValue(
        event,
      ),
    );
  }

  onFeedingSideInput(
    event: Event,
  ): void {
    const value =
      this.readControlValue(
        event,
      );

    if (
      value === 'keep' ||
      value === 'left' ||
      value === 'right' ||
      value === 'none'
    ) {
      this.feedingSideInput.set(
        value,
      );
    }
  }

  onBottleMlInput(event: Event): void {
    this.bottleMlInput.set(this.readControlValue(event));
  }

  onDiaperTypeInput(
    event: Event,
  ): void {
    const value =
      this.readControlValue(
        event,
      );

    if (
      value === 'wet' ||
      value === 'dirty' ||
      value === 'both'
    ) {
      this.diaperTypeInput.set(
        value,
      );
    }
  }

  async saveEditing(
    event: Event,
  ): Promise<void> {
    event.preventDefault();

    const activity =
      this.activity();

    if (!activity) {
      this.editError.set(
        'O registro não está mais disponível.',
      );

      return;
    }

    this.editError.set(
      null,
    );

    let saved =
      false;

    switch (
      activity.kind
    ) {
      case 'feeding':
        saved =
          await this.saveFeeding(
            activity.record,
          );
        break;

      case 'sleep':
        saved =
          await this.saveSleep(
            activity.record,
          );
        break;

      case 'diaper':
        saved =
          await this.saveDiaper(
            activity.record,
          );
        break;
    }

    if (
      !saved &&
      this.editError() ===
        null
    ) {
      this.editError.set(
        this.syncError() ??
          'Não foi possível salvar as alterações.',
      );

      return;
    }

    if (saved) {
      this.editing.set(
        false,
      );
    }
  }

  feedingDuration(
    record: Feeding,
  ): number {
    return (
      this.feedingService
        .durations(
          record,
        )
        .total
    );
  }

  feedingLeftDuration(
    record: Feeding,
  ): number {
    return (
      this.feedingService
        .durations(
          record,
        )
        .left
    );
  }

  feedingRightDuration(
    record: Feeding,
  ): number {
    return (
      this.feedingService
        .durations(
          record,
        )
        .right
    );
  }

  feedingUnspecifiedDuration(
    record: Feeding,
  ): number {
    const durations =
      this.feedingService
        .durations(
          record,
        );

    return (
      durations.unspecified +
      durations.untracked
    );
  }

  sleepDuration(
    record: Sleep,
  ): number {
    return this.sleepService
      .duration(
        record,
      );
  }

  diaperLabel(
    record: Diaper,
  ): string {
    return this.diaperService
      .label(
        record.type,
      );
  }

  formatDateTime(
    timestamp: number,
  ): string {
    return new Intl
      .DateTimeFormat(
        'pt-BR',
        {
          dateStyle:
            'long',

          timeStyle:
            'short',
        },
      )
      .format(
        new Date(
          timestamp,
        ),
      );
  }

  formatDuration(
    milliseconds: number,
  ): string {
    const totalSeconds =
      Math.max(
        0,

        Math.floor(
          milliseconds /
            1000,
        ),
      );

    const hours =
      Math.floor(
        totalSeconds /
          3600,
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) /
          60,
      );

    const seconds =
      totalSeconds % 60;

    const parts:
      string[] = [];

    if (hours > 0) {
      parts.push(
        `${hours}h`,
      );
    }

    if (minutes > 0) {
      parts.push(
        `${minutes}min`,
      );
    }

    if (
      seconds > 0 ||
      parts.length === 0
    ) {
      parts.push(
        `${seconds}s`,
      );
    }

    return parts.join(
      ' ',
    );
  }

  private async saveFeeding(
    record: Feeding,
  ): Promise<boolean> {
    if (
      record.endedAt ===
      null
    ) {
      return false;
    }

    if (record.bottleMl !== undefined) {
      const recordedAt = this.parseDateTimeInput(this.startedAtInput());
      const volumeMl = Number(this.bottleMlInput());

      if (recordedAt === null || recordedAt > Date.now() || !Number.isSafeInteger(volumeMl) ||
        volumeMl < 1 || volumeMl > 1000) {
        this.editError.set('Informe um horário válido e um volume entre 1 e 1000 ml.');
        return false;
      }

      return this.feedingService.updateCompleted({
        ...record,
        startedAt: recordedAt,
        endedAt: recordedAt,
        side: null,
        periods: null,
        bottleMl: volumeMl,
      });
    }

    const range =
      this.readDateRange();

    if (!range) {
      return false;
    }

    const selection =
      this.feedingSideInput();

    let periods:
      readonly FeedingPeriod[] |
      null;

    let side:
      FeedingSide | null;

    if (
      selection ===
      'keep'
    ) {
      periods =
        this.resizeFeedingPeriods(
          record,
          range.startedAt,
          range.endedAt,
        );

      side =
        periods &&
        periods.length > 0
          ? periods[
              periods.length -
                1
            ].side
          : record.side;
    } else {
      side =
        selection ===
        'none'
          ? null
          : selection;

      periods = [
        {
          startedAt:
            range.startedAt,

          endedAt:
            range.endedAt,

          side,
        },
      ];
    }

    return (
      await this.feedingService
        .updateCompleted({
          ...record,

          startedAt:
            range.startedAt,

          endedAt:
            range.endedAt,

          side,

          periods,
        })
    );
  }

  private async saveSleep(
    record: Sleep,
  ): Promise<boolean> {
    const range =
      this.readDateRange();

    if (!range) {
      return false;
    }

    return (
      await this.sleepService
        .updateCompleted({
          ...record,

          startedAt:
            range.startedAt,

          endedAt:
            range.endedAt,
        })
    );
  }

  private async saveDiaper(
    record: Diaper,
  ): Promise<boolean> {
    const recordedAt =
      this.parseDateTimeInput(
        this.startedAtInput(),
      );

    if (
      recordedAt ===
      null
    ) {
      this.editError.set(
        'Informe uma data e um horário válidos.',
      );

      return false;
    }

    if (
      recordedAt >
      Date.now()
    ) {
      this.editError.set(
        'O horário do registro não pode estar no futuro.',
      );

      return false;
    }

    return (
      await this.diaperService
        .update({
          ...record,

          recordedAt,

          type:
            this.diaperTypeInput(),
        })
    );
  }

  private syncError():
    string | null {
    return (
      this.feedingService
        .storageError() ??
      this.sleepService
        .storageError() ??
      this.diaperService
        .storageError()
    );
  }

  private readDateRange(): {
    startedAt: number;
    endedAt: number;
  } | null {
    const startedAt =
      this.parseDateTimeInput(
        this.startedAtInput(),
      );

    const endedAt =
      this.parseDateTimeInput(
        this.endedAtInput(),
      );

    if (
      startedAt === null ||
      endedAt === null
    ) {
      this.editError.set(
        'Informe a data e o horário de início e fim.',
      );

      return null;
    }

    if (
      endedAt <
      startedAt
    ) {
      this.editError.set(
        'O horário final não pode ser anterior ao início.',
      );

      return null;
    }

    if (
      startedAt >
        Date.now() ||
      endedAt >
        Date.now()
    ) {
      this.editError.set(
        'Os horários não podem estar no futuro.',
      );

      return null;
    }

    return {
      startedAt,
      endedAt,
    };
  }

  private resizeFeedingPeriods(
    record: Feeding,
    startedAt: number,
    endedAt: number,
  ):
    readonly FeedingPeriod[] |
    null {
    if (
      record.periods ===
        null ||
      record.periods
        .length === 0 ||
      record.endedAt ===
        null
    ) {
      return null;
    }

    const previousDuration =
      Math.max(
        1,

        record.endedAt -
          record.startedAt,
      );

    const nextDuration =
      endedAt -
      startedAt;

    let cursor =
      startedAt;

    return record.periods
      .map(
        (
          period,
          index,
        ) => {
          const isLast =
            index ===
            record.periods!
              .length -
              1;

          const previousEnd =
            period.endedAt ??
            record.endedAt!;

          const relativeEnd =
            (
              previousEnd -
              record.startedAt
            ) /
            previousDuration;

          const calculatedEnd =
            startedAt +
            Math.round(
              relativeEnd *
                nextDuration,
            );

          const periodEnd =
            isLast
              ? endedAt
              : Math.min(
                  endedAt,

                  Math.max(
                    cursor,
                    calculatedEnd,
                  ),
                );

          const resized:
            FeedingPeriod = {
              startedAt:
                cursor,

              endedAt:
                periodEnd,

              side:
                period.side,
            };

          cursor =
            periodEnd;

          return resized;
        },
      );
  }

  private parseDateTimeInput(
    value: string,
  ): number | null {
    if (!value) {
      return null;
    }

    const timestamp =
      new Date(
        value,
      ).getTime();

    return Number.isFinite(
      timestamp,
    )
      ? timestamp
      : null;
  }

  private toDateTimeInput(
    timestamp: number,
  ): string {
    const date =
      new Date(
        timestamp,
      );

    const pad =
      (
        value: number,
      ): string =>
        value
          .toString()
          .padStart(
            2,
            '0',
          );

    return [
      date.getFullYear(),
      '-',
      pad(
        date.getMonth() +
          1,
      ),
      '-',
      pad(
        date.getDate(),
      ),
      'T',
      pad(
        date.getHours(),
      ),
      ':',
      pad(
        date.getMinutes(),
      ),
    ].join('');
  }

  private readControlValue(
    event: Event,
  ): string {
    const target =
      event.target;

    if (
      target instanceof
        HTMLInputElement ||
      target instanceof
        HTMLSelectElement
    ) {
      return target.value;
    }

    return '';
  }
}
