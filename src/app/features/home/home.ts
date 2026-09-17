import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FeedingService } from '../../core/services/feeding';
import { OnboardingService } from '../../core/services/onboarding';

interface RoutineEvent {
  type: 'feeding' | 'diaper' | 'sleep';
  title: string;
  time: string;
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

  readonly activeFeeding = this.feedingService.activeFeeding;

  openFeeding(): void {
    this.feedingService.start();
    void this.router.navigate(['/feeding']);
  }
  
  readonly caregiverName = this.onboarding.caregiverName;
  readonly babyName = this.onboarding.babyName;
  readonly babyBirthDate = this.onboarding.babyBirthDate;

  readonly events: RoutineEvent[] = [
    {
      type: 'feeding',
      title: 'Mamada',
      time: '23:10',
      description: '18 min · lado esquerdo',
    },
    {
      type: 'diaper',
      title: 'Fralda',
      time: '21:45',
      description: 'Molhada',
    },
    {
      type: 'sleep',
      title: 'Sono',
      time: '20:30',
      description: 'Duração: 1h 05min',
    },
    {
      type: 'feeding',
      title: 'Mamada',
      time: '18:55',
      description: '14 min · lado direito',
    },
  ];

  greeting(): string {
  const hour = new Date().getHours();

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
    const today = new Date();

    let months =
      (today.getFullYear() - birthDate.getFullYear()) * 12 +
      today.getMonth() -
      birthDate.getMonth();

    if (today.getDate() < birthDate.getDate()) {
      months--;
    }

    if (months <= 0) {
      const milliseconds =
        today.getTime() - birthDate.getTime();

      const days = Math.max(
        0,
        Math.floor(
          milliseconds / (1000 * 60 * 60 * 24),
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

    const years = Math.floor(months / 12);

    return years === 1
      ? '1 ano'
      : `${years} anos`;
  }
}