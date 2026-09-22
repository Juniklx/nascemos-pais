import {
  Component,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import type {
  DiaperType,
} from '../../core/models/diaper';
import { DiaperService } from '../../core/services/diaper';
import { OnboardingService } from '../../core/services/onboarding';

@Component({
  selector: 'app-diaper',
  imports: [DatePipe, RouterLink],
  templateUrl: './diaper.html',
  styleUrl: './diaper.css',
})
export class DiaperPage {
  private readonly diaperService =
    inject(DiaperService);

  private readonly onboarding =
    inject(OnboardingService);

  readonly babyName =
    this.onboarding.babyName;

  readonly storageError =
    this.diaperService.storageError;

  readonly isSaving =
    this.diaperService.isSaving;

  readonly selectedType =
    signal<DiaperType | null>(null);

  readonly savedType =
    signal<DiaperType | null>(null);

  readonly savedAt =
    signal<number | null>(null);

  selectType(type: DiaperType): void {
    this.selectedType.set(type);
  }

  async register(): Promise<void> {
    const type =
      this.selectedType();

    if (!type) {
      return;
    }

    const diaper =
      await this.diaperService
        .register(type);

    if (diaper === null) {
      return;
    }

    this.savedType.set(
      diaper.type,
    );

    this.savedAt.set(
      diaper.recordedAt,
    );

    this.selectedType.set(
      null,
    );
  }

  label(type: DiaperType): string {
    return this.diaperService
      .label(type);
  }
}