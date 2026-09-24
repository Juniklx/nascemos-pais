import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Diaper } from '../../core/models/diaper';
import type { Feeding } from '../../core/models/feeding';
import type { Sleep } from '../../core/models/sleep';
import { BabyContextService } from '../../core/services/baby-context';
import { DiaperService } from '../../core/services/diaper';
import { FeedingService } from '../../core/services/feeding';
import { SleepService } from '../../core/services/sleep';

type RoutineKind = 'feeding' | 'sleep' | 'diaper';

interface RoutineEvent {
  readonly id: string;
  readonly kind: RoutineKind;
  readonly title: string;
  readonly time: string;
  readonly dateTime: string;
  readonly timestamp: number;
  readonly description: string;
}

@Component({
  selector: 'app-routine',
  imports: [RouterLink],
  templateUrl: './routine.html',
  styleUrl: './routine.css',
})
export class Routine {
  private readonly babyContext = inject(BabyContextService);
  private readonly feedingService = inject(FeedingService);
  private readonly sleepService = inject(SleepService);
  private readonly diaperService = inject(DiaperService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(Date.now());

  private readonly timeFormatter = new Intl.DateTimeFormat(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );

  readonly babyName = computed(() => this.babyContext.baby()?.name ?? '');

  readonly storageError = computed(
    () =>
      this.feedingService.storageError() ??
      this.sleepService.storageError() ??
      this.diaperService.storageError(),
  );

  readonly events = computed<readonly RoutineEvent[]>(() => {
    const currentTime = this.now();

    const startOfDay = new Date(currentTime);
    startOfDay.setHours(0, 0, 0, 0);

    const nextDay = new Date(startOfDay);
    nextDay.setDate(nextDay.getDate() + 1);

    const start = startOfDay.getTime();
    const end = nextDay.getTime();

    const feedingEvents: RoutineEvent[] =
      this.feedingService
        .feedings()
        .filter(
          (feeding) =>
            feeding.startedAt >= start &&
            feeding.startedAt < end,
        )
        .map((feeding) => ({
          id: feeding.id,
          kind: 'feeding',
          title:
            feeding.bottleMl !== undefined
              ? 'Mamadeira'
              : feeding.endedAt === null
              ? 'Mamada em andamento'
              : 'Mamada',
          time: this.timeFormatter.format(
            feeding.startedAt,
          ),
          dateTime: new Date(
            feeding.startedAt,
          ).toISOString(),
          timestamp: feeding.startedAt,
          description: this.feedingDescription(
            feeding,
            currentTime,
          ),
        }));

    const sleepEvents: RoutineEvent[] =
      this.sleepService
        .sleeps()
        .filter(
          (sleep) =>
            sleep.startedAt >= start &&
            sleep.startedAt < end,
        )
        .map((sleep) => ({
          id: sleep.id,
          kind: 'sleep',
          title:
            sleep.endedAt === null
              ? 'Sono em andamento'
              : 'Sono',
          time: this.timeFormatter.format(
            sleep.startedAt,
          ),
          dateTime: new Date(
            sleep.startedAt,
          ).toISOString(),
          timestamp: sleep.startedAt,
          description: this.sleepDescription(
            sleep,
            currentTime,
          ),
        }));

    const diaperEvents: RoutineEvent[] =
      this.diaperService
        .diapers()
        .filter(
          (diaper) =>
            diaper.recordedAt >= start &&
            diaper.recordedAt < end,
        )
        .map((diaper) => ({
          id: diaper.id,
          kind: 'diaper',
          title: 'Fralda',
          time: this.timeFormatter.format(
            diaper.recordedAt,
          ),
          dateTime: new Date(
            diaper.recordedAt,
          ).toISOString(),
          timestamp: diaper.recordedAt,
          description: this.diaperService.label(
            diaper.type,
          ),
        }));

    return [
      ...feedingEvents,
      ...sleepEvents,
      ...diaperEvents,
    ].sort((a, b) => b.timestamp - a.timestamp);
  });

  constructor() {
    const intervalId = setInterval(() => {
      this.now.set(Date.now());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalId);
    });
  }

  private feedingDescription(
    feeding: Feeding,
    now: number,
  ): string {
    if (feeding.bottleMl !== undefined) {
      return `${feeding.bottleMl} ml`;
    }

    const times = this.feedingService.durations(
      feeding,
      now,
    );

    const status =
      feeding.endedAt === null
        ? 'Em andamento'
        : this.formatDuration(times.total);

    if (feeding.periods === null) {
      const side =
        feeding.side === 'left'
          ? 'lado esquerdo'
          : feeding.side === 'right'
            ? 'lado direito'
            : 'lado não informado';

      return `${status} · ${side}`;
    }

    const details: string[] = [];

    if (times.left > 0) {
      details.push(
        `Esq. ${this.formatDuration(times.left)}`,
      );
    }

    if (times.right > 0) {
      details.push(
        `Dir. ${this.formatDuration(times.right)}`,
      );
    }

    if (times.unspecified > 0) {
      details.push(
        `Sem lado ${this.formatDuration(times.unspecified)}`,
      );
    }

    if (times.untracked > 0) {
      details.push(
        `Sem divisão ${this.formatDuration(times.untracked)}`,
      );
    }

    return [
      status,
      ...(details.length > 0
        ? [`Por lado: ${details.join(' · ')}`]
        : []),
    ].join(' · ');
  }

  private sleepDescription(
    sleep: Sleep,
    now: number,
  ): string {
    const duration = this.sleepService.duration(
      sleep,
      now,
    );

    const formatted = this.formatDuration(duration);

    return sleep.endedAt === null
      ? `Em andamento · ${formatted}`
      : formatted;
  }

  private formatDuration(milliseconds: number): string {
    const totalSeconds = Math.max(
      0,
      Math.floor(milliseconds / 1000),
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }

    if (minutes > 0) {
      return seconds === 0
        ? `${minutes} min`
        : `${minutes} min ${seconds} s`;
    }

    return `${seconds} s`;
  }
}
