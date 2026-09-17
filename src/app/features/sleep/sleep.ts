import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import type { Sleep } from '../../core/models/sleep';
import { SleepService } from '../../core/services/sleep';
import { OnboardingService } from '../../core/services/onboarding';

@Component({
  selector: 'app-sleep',
  imports: [DatePipe, RouterLink],
  templateUrl: './sleep.html',
  styleUrl: './sleep.css',
})
export class SleepPage {
  private readonly sleepService = inject(SleepService);
  private readonly onboarding = inject(OnboardingService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(Date.now());

  readonly babyName = this.onboarding.babyName;
  readonly activeSleep = this.sleepService.activeSleep;
  readonly storageError = this.sleepService.storageError;
  readonly finishedSleep = signal<Sleep | null>(null);

  readonly displayedSleep = computed(
    () => this.activeSleep() ?? this.finishedSleep(),
  );

  readonly elapsedTime = computed(() => {
    const sleep = this.displayedSleep();

    return this.formatDuration(
      sleep
        ? this.sleepService.duration(sleep, this.now())
        : 0,
    );
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
    this.finishedSleep.set(null);
    this.sleepService.start();
    this.now.set(Date.now());
  }

  finish(): void {
    const finished = this.sleepService.finish();

    if (finished) {
      this.finishedSleep.set(finished);
      this.now.set(Date.now());
    }
  }

  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(
      Math.max(0, milliseconds) / 1000,
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  }
}