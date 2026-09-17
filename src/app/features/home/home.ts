import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import type { Feeding } from '../../core/models/feeding';
import { FeedingService } from '../../core/services/feeding';
import { OnboardingService } from '../../core/services/onboarding';

interface RoutineEvent {
  id: string;
  type: 'feeding' | 'diaper' | 'sleep';
  title: string;
  time: string;
  dateTime: string;
  description: string;
}

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

  private readonly now = signal(Date.now());

  private readonly timeFormatter = new Intl.DateTimeFormat(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );

  readonly caregiverName = this.onboarding.caregiverName;
  readonly babyName = this.onboarding.babyName;
  readonly babyBirthDate = this.onboarding.babyBirthDate;

  readonly activeFeeding = this.feedingService.activeFeeding;
  readonly storageError = this.feedingService.storageError;

  readonly lastCompletedFeeding = computed(() =>
    this.feedingService.completedFeedings().reduce<Feeding | null>(
      (latest, feeding) => {
        if (
          latest === null ||
          (feeding.endedAt ?? 0) > (latest.endedAt ?? 0)
        ) {
          return feeding;
        }

        return latest;
      },
      null,
    ),
  );

  readonly lastFeedingElapsed = computed(() => {
    const endedAt = this.lastCompletedFeeding()?.endedAt;

    if (endedAt === null || endedAt === undefined) {
      return '';
    }

    const minutes = Math.floor(
      Math.max(0, this.now() - endedAt) / 60_000,
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

    return days === 1 ? 'há 1 dia' : `há ${days} dias`;
  });

  readonly events = computed<RoutineEvent[]>(() => {
    const startOfDay = new Date(this.now());
    startOfDay.setHours(0, 0, 0, 0);

    const nextDay = new Date(startOfDay);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.feedingService
      .feedings()
      .filter(
        (feeding) =>
          feeding.startedAt >= startOfDay.getTime() &&
          feeding.startedAt < nextDay.getTime(),
      )
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((feeding) => ({
        id: feeding.id,
        type: 'feeding',
        title:
          feeding.endedAt === null
            ? 'Mamada em andamento'
            : 'Mamada',
        time: this.timeFormatter.format(feeding.startedAt),
        dateTime: new Date(feeding.startedAt).toISOString(),
        description: this.feedingDescription(feeding),
      }));
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
    const side =
      feeding.side === 'left'
        ? 'lado esquerdo'
        : feeding.side === 'right'
          ? 'lado direito'
          : 'lado não informado';

    if (feeding.endedAt === null) {
      return `Em andamento · ${side}`;
    }

    const seconds = Math.floor(
      Math.max(0, feeding.endedAt - feeding.startedAt) / 1000,
    );

    if (seconds < 60) {
      return `${seconds} s · ${side}`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} min · ${side}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    const duration =
      remainingMinutes === 0
        ? `${hours}h`
        : `${hours}h ${remainingMinutes}min`;

    return `${duration} · ${side}`;
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