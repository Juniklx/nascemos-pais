import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Sleep } from '../../core/models/sleep';
import { SleepService } from '../../core/services/sleep';
import type { Feeding } from '../../core/models/feeding';
import { FeedingService } from '../../core/services/feeding';
import { OnboardingService } from '../../core/services/onboarding';
import { DiaperService } from '../../core/services/diaper';
import type { Diaper } from '../../core/models/diaper';

interface RoutineEvent {
  id: string;
  type: 'feeding' | 'diaper' | 'sleep';
  title: string;
  time: string;
  dateTime: string;
  description: string;
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
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly feedingService = inject(FeedingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sleepService = inject(SleepService);
  readonly activeSleep = this.sleepService.activeSleep;
  private readonly now = signal(Date.now());
  private readonly diaperService = inject(DiaperService);

  openDiaper(): void {
    void this.router.navigate(['/diaper']);
  }
  openHistory(): void {
    void this.router.navigate(['/history']);
  }
  openVoice(): void {
    void this.router.navigate(['/voice']);
  }
  openProfile(): void {
    void this.router.navigate(['/profile']);
  }
  private readonly timeFormatter = new Intl.DateTimeFormat(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );


  openSleep(): void {
    this.sleepService.start();
    void this.router.navigate(['/sleep']);
  }

  readonly caregiverName = this.onboarding.caregiverName;
  readonly babyName = this.onboarding.babyName;
  readonly babyBirthDate = this.onboarding.babyBirthDate;

  readonly activeFeeding = this.feedingService.activeFeeding;
  readonly storageError = this.feedingService.storageError;

  readonly lastCompletedActivity = computed<HomeActivity | null>(() => {
    const activities: HomeActivity[] = [
      ...this.feedingService.completedFeedings().map(
        (record) => ({
          kind: 'feeding' as const,
          record,
        }),
      ),
      ...this.sleepService.completedSleeps().map(
        (record) => ({
          kind: 'sleep' as const,
          record,
        }),
      ),
      ...this.diaperService.diapers().map(
        (record) => ({
          kind: 'diaper' as const,
          record,
        }),
      ),
    ];

    return activities.reduce<HomeActivity | null>(
      (latest, activity) => {
        if (
          latest === null ||
          this.activityTimestamp(activity) >
          this.activityTimestamp(latest)
        ) {
          return activity;
        }

        return latest;
      },
      null,
    );
  });
  private activityTimestamp(
    activity: HomeActivity,
  ): number {
    if (activity.kind === 'diaper') {
      return activity.record.recordedAt;
    }

    return activity.record.endedAt ?? 0;
  }

  diaperDescription(diaper: Diaper): string {
    return `Fralda · ${this.diaperService.label(
      diaper.type,
    )}`;
  }

  readonly lastActivityElapsed = computed(() => {
    const activity = this.lastCompletedActivity();

    if (!activity) {
      return '';
    }

    const recordedAt = this.activityTimestamp(activity);

    const minutes = Math.floor(
      Math.max(0, this.now() - recordedAt) / 60_000,
    );

    if (minutes === 0) {
      return 'há menos de 1 min';
    }

    if (minutes < 60) {
      return `há ${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
      return remainingMinutes === 0
        ? `há ${hours}h`
        : `há ${hours}h ${remainingMinutes}min`;
    }

    const days = Math.floor(hours / 24);

    return days === 1
      ? 'há 1 dia'
      : `há ${days} dias`;
  });

  sleepDescription(sleep: Sleep): string {
    const duration = this.sleepService.duration(
      sleep,
      this.now(),
    );

    if (sleep.endedAt === null) {
      return `Em andamento · ${this.formatFeedingDuration(duration)}`;
    }

    return this.formatFeedingDuration(duration);
  }

  readonly events = computed<RoutineEvent[]>(() => {
    const startOfDay = new Date(this.now());
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
          type: 'feeding',
          title:
            feeding.endedAt === null
              ? 'Mamada em andamento'
              : 'Mamada',
          time: this.timeFormatter.format(
            feeding.startedAt,
          ),
          dateTime: new Date(
            feeding.startedAt,
          ).toISOString(),
          description: this.feedingDescription(feeding),
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
          type: 'sleep',
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
          description: this.sleepDescription(sleep),
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
          type: 'diaper',
          title: 'Fralda',
          time: this.timeFormatter.format(
            diaper.recordedAt,
          ),
          dateTime: new Date(
            diaper.recordedAt,
          ).toISOString(),
          description: this.diaperService.label(
            diaper.type,
          ),
        }));

    return [
      ...feedingEvents,
      ...sleepEvents,
      ...diaperEvents,
    ].sort(
      (a, b) =>
        new Date(b.dateTime).getTime() -
        new Date(a.dateTime).getTime(),
    );
  });

  constructor() {
    const intervalId = setInterval(() => {
      this.now.set(Date.now());
    }, 15_000);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalId);
    });
  }

  openFeeding(): void {
    this.feedingService.start();
    void this.router.navigate(['/feeding']);
  }

  feedingDescription(feeding: Feeding): string {
    const times = this.feedingService.durations(
      feeding,
      this.now(),
    );

    const status =
      feeding.endedAt === null
        ? 'Em andamento'
        : this.formatFeedingDuration(times.total);

    if (feeding.periods === null) {
      const side =
        feeding.side === 'left'
          ? 'lado esquerdo informado'
          : feeding.side === 'right'
            ? 'lado direito informado'
            : 'lado não informado';

      return `${status} · ${side} · sem divisão de tempo`;
    }

    const details: string[] = [];

    if (times.left > 0) {
      details.push(
        `Esq. ${this.formatFeedingDuration(times.left)}`,
      );
    }

    if (times.right > 0) {
      details.push(
        `Dir. ${this.formatFeedingDuration(times.right)}`,
      );
    }

    if (times.unspecified > 0) {
      details.push(
        `Sem lado ${this.formatFeedingDuration(times.unspecified)}`,
      );
    }

    if (times.untracked > 0) {
      details.push(
        `Sem divisão ${this.formatFeedingDuration(times.untracked)}`,
      );
    }

    return [
      status,
      ...(details.length > 0
        ? [`Por lado (aprox.): ${details.join(' · ')}`]
        : []),
    ].join(' · ');
  }

  private formatFeedingDuration(milliseconds: number): string {
    const seconds = Math.max(
      0,
      Math.floor(milliseconds / 1000),
    );

    if (seconds < 60) {
      return `${seconds} s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds === 0
        ? `${minutes} min`
        : `${minutes} min ${remainingSeconds} s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}min ${remainingSeconds}s`;
  }

  greeting(): string {
    const hour = new Date(this.now()).getHours();

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
    const value = this.babyBirthDate();

    if (!value) {
      return '';
    }

    const birthDate = new Date(`${value}T00:00:00`);
    const today = new Date(this.now());

    if (
      Number.isNaN(birthDate.getTime()) ||
      birthDate.getTime() > today.getTime()
    ) {
      return '';
    }

    let months =
      (today.getFullYear() - birthDate.getFullYear()) * 12 +
      today.getMonth() -
      birthDate.getMonth();

    if (today.getDate() < birthDate.getDate()) {
      months--;
    }

    if (months <= 0) {
      const todayCalendarDate = Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      const birthCalendarDate = Date.UTC(
        birthDate.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate(),
      );

      const days = Math.max(
        0,
        Math.floor(
          (todayCalendarDate - birthCalendarDate) / 86_400_000,
        ),
      );

      return days === 1 ? '1 dia' : `${days} dias`;
    }

    if (months === 1) {
      return '1 mês';
    }

    if (months < 24) {
      return `${months} meses`;
    }

    const years = Math.floor(months / 12);

    return years === 1 ? '1 ano' : `${years} anos`;
  }
}