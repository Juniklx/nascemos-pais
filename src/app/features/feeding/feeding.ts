import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import type { Feeding } from '../../core/models/feeding';
import { FeedingService } from '../../core/services/feeding';
import { OnboardingService } from '../../core/services/onboarding';

@Component({
  selector: 'app-feeding',
  imports: [DatePipe, RouterLink],
  templateUrl: './feeding.html',
  styleUrl: './feeding.css',
})
export class FeedingPage {
  private readonly feedingService = inject(FeedingService);
  private readonly onboarding = inject(OnboardingService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(Date.now());

  readonly babyName = this.onboarding.babyName;
  readonly activeFeeding = this.feedingService.activeFeeding;
  readonly storageError = this.feedingService.storageError;
  readonly isSaving = this.feedingService.isSaving;
  readonly legacyOversized = this.feedingService.legacyOversized;

  readonly finishedFeeding = signal<Feeding | null>(null);

  readonly displayedFeeding = computed(
    () => this.activeFeeding() ?? this.finishedFeeding(),
  );

  readonly durations = computed(() => {
    const feeding = this.displayedFeeding();

    return feeding
      ? this.feedingService.durations(feeding, this.now())
      : null;
  });

  readonly elapsedTime = computed(() =>
    this.formatDuration(this.durations()?.total ?? 0),
  );

  constructor() {
    const intervalId = setInterval(() => {
      this.now.set(Date.now());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalId);
    });
  }

  async start(): Promise<void> {
    this.finishedFeeding.set(null);

    const feeding =
      await this.feedingService.start();

    if (feeding !== null) {
      this.now.set(Date.now());
    }
  }

  async finish(): Promise<void> {
    const finished =
      await this.feedingService.finish();

    if (finished !== null) {
      this.finishedFeeding.set(finished);
      this.now.set(Date.now());
    }
  }

  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.max(
      0,
      Math.floor(milliseconds / 1000),
    );

    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );

    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) =>
        String(value).padStart(2, '0'),
      )
      .join(':');
  }
}