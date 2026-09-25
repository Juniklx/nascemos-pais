import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import type {
  Diaper,
} from '../../core/models/diaper';
import type {
  Feeding,
} from '../../core/models/feeding';
import type {
  Sleep,
} from '../../core/models/sleep';

import { ActivityPersistenceService } from '../../core/services/activity-persistence';
import { BabyContextService } from '../../core/services/baby-context';
import { DiaperService } from '../../core/services/diaper';
import { FeedingService } from '../../core/services/feeding';
import { OnboardingService } from '../../core/services/onboarding';
import { SleepService } from '../../core/services/sleep';

interface RoutineEvent {
  id: string;
  type:
    | 'feeding'
    | 'diaper'
    | 'sleep';
  title: string;
  time: string;
  dateTime: string;
  description: string;
  attribution: string | null;
}

type HomeActivity =
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

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly onboarding =
    inject(OnboardingService);

  private readonly router =
    inject(Router);

  private readonly babyContext =
    inject(BabyContextService);

  private readonly persistence = inject(ActivityPersistenceService);

  private readonly feedingService =
    inject(FeedingService);

  private readonly sleepService =
    inject(SleepService);

  private readonly diaperService =
    inject(DiaperService);

  private readonly destroyRef =
    inject(DestroyRef);

  private readonly now =
    signal(Date.now());

  private readonly timeFormatter =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    );

  readonly caregiverName =
    this.onboarding.caregiverName;

  readonly babyName =
    computed(
      () =>
        this.babyContext
          .baby()
          ?.name ?? '',
    );

  readonly babyBirthDate =
    computed(
      () =>
        this.babyContext
          .baby()
          ?.birthDate ?? '',
    );

  readonly activeFeeding =
    this.feedingService.activeFeeding;

  readonly activeSleep =
    this.sleepService.activeSleep;

  /*
   * Os três serviços compartilham o mesmo
   * estado de erro do ActivityPersistenceService.
   */
  readonly storageError =
    this.feedingService.storageError;

  readonly isLoading =
    this.feedingService.isLoading;

  readonly lastCompletedActivity =
    computed<HomeActivity | null>(() => {
      const activities:
        HomeActivity[] = [
          ...this.feedingService
            .completedFeedings()
            .map(
              (record) => ({
                kind:
                  'feeding' as const,

                record,
              }),
            ),

          ...this.sleepService
            .completedSleeps()
            .map(
              (record) => ({
                kind:
                  'sleep' as const,

                record,
              }),
            ),

          ...this.diaperService
            .diapers()
            .map(
              (record) => ({
                kind:
                  'diaper' as const,

                record,
              }),
            ),
        ];

      return activities.reduce<
        HomeActivity | null
      >(
        (
          latest,
          activity,
        ) => {
          if (
            latest === null ||
            this.activityTimestamp(
              activity,
            ) >
              this.activityTimestamp(
                latest,
              )
          ) {
            return activity;
          }

          return latest;
        },
        null,
      );
    });

  readonly lastActivityAttribution = computed(() => {
    const activity = this.lastCompletedActivity();

    return activity === null ? null : this.activityAttribution(
      activity.record.createdByUid,
      'finishedByUid' in activity.record ? activity.record.finishedByUid : undefined,
    );
  });

  readonly activeFeedingAttribution = computed(() =>
    this.activityAttribution(this.activeFeeding()?.createdByUid),
  );

  readonly activeSleepAttribution = computed(() =>
    this.activityAttribution(this.activeSleep()?.createdByUid),
  );

  private activityAttribution(createdByUid?: string, finishedByUid?: string): string | null {
    const creator = this.persistence.actorName(createdByUid);
    const finisher = this.persistence.actorName(finishedByUid);

    if (creator && finisher) {
      return `Iniciado por ${creator} · Finalizado por ${finisher}`;
    }

    if (creator) {
      return `Registrado por ${creator}`;
    }

    return finisher ? `Finalizado por ${finisher}` : null;
  }

  readonly lastActivityElapsed =
    computed(() => {
      const activity =
        this.lastCompletedActivity();

      if (!activity) {
        return '';
      }

      const recordedAt =
        this.activityTimestamp(
          activity,
        );

      const minutes =
        Math.floor(
          Math.max(
            0,
            this.now() -
              recordedAt,
          ) / 60_000,
        );

      if (minutes === 0) {
        return 'há menos de 1 min';
      }

      if (minutes < 60) {
        return `há ${minutes} min`;
      }

      const hours =
        Math.floor(
          minutes / 60,
        );

      const remainingMinutes =
        minutes % 60;

      if (hours < 24) {
        return (
          remainingMinutes ===
          0
            ? `há ${hours}h`
            : `há ${hours}h ${remainingMinutes}min`
        );
      }

      const days =
        Math.floor(
          hours / 24,
        );

      return days === 1
        ? 'há 1 dia'
        : `há ${days} dias`;
    });

  readonly events =
    computed<RoutineEvent[]>(
      () => {
        const startOfDay =
          new Date(
            this.now(),
          );

        startOfDay.setHours(
          0,
          0,
          0,
          0,
        );

        const nextDay =
          new Date(
            startOfDay,
          );

        nextDay.setDate(
          nextDay.getDate() +
            1,
        );

        const start =
          startOfDay.getTime();

        const end =
          nextDay.getTime();

        const feedingEvents:
          RoutineEvent[] =
            this.feedingService
              .feedings()
              .filter(
                (feeding) =>
                  feeding.startedAt >=
                    start &&
                  feeding.startedAt <
                    end,
              )
              .map(
                (feeding) => ({
                  id:
                    feeding.id,

                  type:
                    'feeding',

                  title:
                    feeding.bottleMl !== undefined
                      ? 'Mamadeira'
                      : feeding.endedAt ===
                    null
                      ? 'Amamentação em andamento'
                      : 'Amamentação',

                  time:
                    this.timeFormatter
                      .format(
                        feeding.startedAt,
                      ),

                  dateTime:
                    new Date(
                      feeding.startedAt,
                    )
                      .toISOString(),

                  description:
                    this.feedingDescription(
                      feeding,
                    ),

                  attribution: this.activityAttribution(
                    feeding.createdByUid,
                    feeding.finishedByUid,
                  ),
                }),
              );

        const sleepEvents:
          RoutineEvent[] =
            this.sleepService
              .sleeps()
              .filter(
                (sleep) =>
                  sleep.startedAt >=
                    start &&
                  sleep.startedAt <
                    end,
              )
              .map(
                (sleep) => ({
                  id:
                    sleep.id,

                  type:
                    'sleep',

                  title:
                    sleep.endedAt ===
                    null
                      ? 'Sono em andamento'
                      : 'Sono',

                  time:
                    this.timeFormatter
                      .format(
                        sleep.startedAt,
                      ),

                  dateTime:
                    new Date(
                      sleep.startedAt,
                    )
                      .toISOString(),

                  description:
                    this.sleepDescription(
                      sleep,
                    ),

                  attribution: this.activityAttribution(
                    sleep.createdByUid,
                    sleep.finishedByUid,
                  ),
                }),
              );

        const diaperEvents:
          RoutineEvent[] =
            this.diaperService
              .diapers()
              .filter(
                (diaper) =>
                  diaper.recordedAt >=
                    start &&
                  diaper.recordedAt <
                    end,
              )
              .map(
                (diaper) => ({
                  id:
                    diaper.id,

                  type:
                    'diaper',

                  title:
                    'Fralda',

                  time:
                    this.timeFormatter
                      .format(
                        diaper.recordedAt,
                      ),

                  dateTime:
                    new Date(
                      diaper.recordedAt,
                    )
                      .toISOString(),

                  description:
                    this.diaperService
                      .label(
                        diaper.type,
                      ),

                  attribution: this.activityAttribution(
                    diaper.createdByUid,
                  ),
                }),
              );

        return [
          ...feedingEvents,
          ...sleepEvents,
          ...diaperEvents,
        ].sort(
          (a, b) =>
            new Date(
              b.dateTime,
            ).getTime() -
            new Date(
              a.dateTime,
            ).getTime(),
        );
      },
    );

  constructor() {
    const intervalId =
      setInterval(
        () => {
          this.now.set(
            Date.now(),
          );
        },
        15_000,
      );

    this.destroyRef
      .onDestroy(() => {
        clearInterval(
          intervalId,
        );
      });
  }

  openDiaper(): void {
    void this.router.navigate([
      '/diaper',
    ]);
  }

  openHistory(): void {
    void this.router.navigate([
      '/history',
    ]);
  }

  openVoice(): void {
    void this.router.navigate([
      '/voice',
    ]);
  }

  openProfile(): void {
    void this.router.navigate([
      '/profile',
    ]);
  }

  async openSleep():
    Promise<void> {
    const sleep =
      await this.sleepService
        .start();

    if (sleep === null) {
      return;
    }

    await this.router.navigate([
      '/sleep',
    ]);
  }

  async openFeeding():
    Promise<void> {
    const feeding =
      await this.feedingService
        .start();

    if (feeding === null) {
      return;
    }

    await this.router.navigate([
      '/feeding',
    ]);
  }

  private activityTimestamp(
    activity: HomeActivity,
  ): number {
    if (
      activity.kind ===
      'diaper'
    ) {
      return (
        activity
          .record
          .recordedAt
      );
    }

    return (
      activity
        .record
        .endedAt ?? 0
    );
  }

  diaperDescription(
    diaper: Diaper,
  ): string {
    return (
      `Fralda · ` +
      this.diaperService
        .label(
          diaper.type,
        )
    );
  }

  sleepDescription(
    sleep: Sleep,
  ): string {
    const duration =
      this.sleepService
        .duration(
          sleep,
          this.now(),
        );

    if (
      sleep.endedAt ===
      null
    ) {
      return (
        `Em andamento · ` +
        this.formatFeedingDuration(
          duration,
        )
      );
    }

    return (
      this.formatFeedingDuration(
        duration,
      )
    );
  }

  feedingDescription(
    feeding: Feeding,
  ): string {
    if (feeding.bottleMl !== undefined) {
      return `Mamadeira · ${feeding.bottleMl} ml`;
    }

    const times =
      this.feedingService
        .durations(
          feeding,
          this.now(),
        );

    const status =
      feeding.endedAt ===
      null
        ? 'Em andamento'
        : this.formatFeedingDuration(
            times.total,
          );

    return status;
  }

  greeting(): string {
    const hour =
      new Date(
        this.now(),
      ).getHours();

    if (hour < 5) {
      return 'Boa noite';
    }

    if (hour < 12) {
      return 'Bom dia';
    }

    if (hour < 18) {
      return 'Boa tarde';
    }

    return 'Boa noite';
  }

  babyAge(): string {
    const value =
      this.babyBirthDate();

    if (!value) {
      return '';
    }

    const birthDate =
      new Date(
        `${value}T00:00:00`,
      );

    const today =
      new Date(
        this.now(),
      );

    if (
      Number.isNaN(
        birthDate.getTime(),
      ) ||
      birthDate.getTime() >
        today.getTime()
    ) {
      return '';
    }

    let months =
      (
        today.getFullYear() -
        birthDate.getFullYear()
      ) *
        12 +
      today.getMonth() -
      birthDate.getMonth();

    if (
      today.getDate() <
      birthDate.getDate()
    ) {
      months--;
    }

    if (months <= 0) {
      const todayCalendarDate =
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        );

      const birthCalendarDate =
        Date.UTC(
          birthDate.getFullYear(),
          birthDate.getMonth(),
          birthDate.getDate(),
        );

      const days =
        Math.max(
          0,

          Math.floor(
            (
              todayCalendarDate -
              birthCalendarDate
            ) /
              86_400_000,
          ),
        );

      return days === 1
        ? '1 dia'
        : `${days} dias`;
    }

    if (months === 1) {
      return '1 mês';
    }

    if (months < 24) {
      return `${months} meses`;
    }

    const years =
      Math.floor(
        months / 12,
      );

    return years === 1
      ? '1 ano'
      : `${years} anos`;
  }

  private formatFeedingDuration(
    milliseconds: number,
  ): string {
    const seconds =
      Math.max(
        0,

        Math.floor(
          milliseconds /
            1000,
        ),
      );

    if (seconds < 60) {
      return `${seconds} s`;
    }

    const minutes =
      Math.floor(
        seconds / 60,
      );

    const remainingSeconds =
      seconds % 60;

    if (minutes < 60) {
      return (
        remainingSeconds ===
        0
          ? `${minutes} min`
          : `${minutes} min ${remainingSeconds} s`
      );
    }

    const hours =
      Math.floor(
        minutes / 60,
      );

    const remainingMinutes =
      minutes % 60;

    return (
      `${hours}h ` +
      `${remainingMinutes}min ` +
      `${remainingSeconds}s`
    );
  }
}
