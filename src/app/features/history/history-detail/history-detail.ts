import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { Diaper } from '../../../core/models/diaper';
import type { Feeding } from '../../../core/models/feeding';
import type { Sleep } from '../../../core/models/sleep';

import { DiaperService } from '../../../core/services/diaper';
import { FeedingService } from '../../../core/services/feeding';
import { SleepService } from '../../../core/services/sleep';

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

@Component({
  selector: 'app-history-detail',
  imports: [RouterLink],
  templateUrl: './history-detail.html',
  styleUrl: './history-detail.css',
})
export class HistoryDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly feedingService = inject(FeedingService);
  private readonly sleepService = inject(SleepService);
  private readonly diaperService = inject(DiaperService);

  private readonly type =
    this.route.snapshot.paramMap.get('type');

  private readonly id =
    this.route.snapshot.paramMap.get('id');

  readonly activity = computed<HistoryActivity | null>(() => {
    if (!this.id) {
      return null;
    }

    switch (this.type) {
      case 'feeding': {
        const record = this.feedingService
          .feedings()
          .find((feeding) => feeding.id === this.id);

        return record
          ? { kind: 'feeding', record }
          : null;
      }

      case 'sleep': {
        const record = this.sleepService
          .sleeps()
          .find((sleep) => sleep.id === this.id);

        return record
          ? { kind: 'sleep', record }
          : null;
      }

      case 'diaper': {
        const record = this.diaperService
          .diapers()
          .find((diaper) => diaper.id === this.id);

        return record
          ? { kind: 'diaper', record }
          : null;
      }

      default:
        return null;
    }
  });

  feedingDuration(record: Feeding): number {
    return this.feedingService.durations(record).total;
  }

  feedingLeftDuration(record: Feeding): number {
    return this.feedingService.durations(record).left;
  }

  feedingRightDuration(record: Feeding): number {
    return this.feedingService.durations(record).right;
  }

  feedingUnspecifiedDuration(record: Feeding): number {
    const durations =
      this.feedingService.durations(record);

    return durations.unspecified + durations.untracked;
  }

  sleepDuration(record: Sleep): number {
    return this.sleepService.duration(record);
  }

  diaperLabel(record: Diaper): string {
    return this.diaperService.label(record.type);
  }

  formatDateTime(timestamp: number): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(timestamp));
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

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (minutes > 0) {
      parts.push(`${minutes}min`);
    }

    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ');
  }
}