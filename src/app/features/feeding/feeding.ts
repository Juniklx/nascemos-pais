import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import type {
  Feeding,
  FeedingSide,
} from '../../core/models/feeding';
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

  readonly finishedFeeding = signal<Feeding | null>(null);

  readonly elapsedTime = computed(() => {
    const feeding =
      this.activeFeeding() ?? this.finishedFeeding();

    if (!feeding) {
      return '00:00:00';
    }

    const end = feeding.endedAt ?? this.now();

    const totalSeconds = Math.max(
      0,
      Math.floor((end - feeding.startedAt) / 1000),
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  });

  constructor() {
    const intervalId = setInterval(() => {
      this.now.set(Date.now());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalId);
    });
  }

  start(): void {
    this.now.set(Date.now());
    this.finishedFeeding.set(null);
    this.feedingService.start();
  }

  setSide(side: FeedingSide | null): void {
    this.feedingService.setSide(side);
  }

  finish(): void {
    const finished = this.feedingService.finish();

    if (finished) {
      this.finishedFeeding.set(finished);
    }
  }
}