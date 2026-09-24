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

type HistoryKind = 'feeding' | 'sleep' | 'diaper';
type HistoryFilter = 'all' | HistoryKind;

interface HistoryEvent {
  readonly id: string;
  readonly kind: HistoryKind;
  readonly title: string;
  readonly time: string;
  readonly dateTime: string;
  readonly timestamp: number;
  readonly description: string;
}

interface FilterOption {
  readonly value: HistoryFilter;
  readonly label: string;
}

@Component({
  selector: 'app-history',
  imports: [RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {
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

  private readonly dateFormatter = new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'full',
    },
  );

  readonly babyName = computed(() => this.babyContext.baby()?.name ?? '');

  readonly selectedDate = signal(
    this.dateValue(new Date()),
  );

  readonly selectedType = signal<HistoryFilter>('all');

  readonly filterOptions: readonly FilterOption[] = [
    {
      value: 'all',
      label: 'Todos',
    },
    {
      value: 'feeding',
      label: 'Mamada',
    },
    {
      value: 'sleep',
      label: 'Sono',
    },
    {
      value: 'diaper',
      label: 'Fralda',
    },
  ];

  readonly storageError = computed(
    () =>
      this.feedingService.storageError() ??
      this.sleepService.storageError() ??
      this.diaperService.storageError(),
  );

  readonly selectedDateLabel = computed(() => {
    const date = this.parseDate(
      this.selectedDate(),
    );

    if (!date) {
      return '';
    }

    const today = this.dateValue(
      new Date(this.now()),
    );

    return this.selectedDate() === today
      ? 'Hoje'
      : this.dateFormatter.format(date);
  });

  readonly events = computed<readonly HistoryEvent[]>(() => {
    const range = this.dayRange(
      this.selectedDate(),
    );

    if (!range) {
      return [];
    }

    const currentTime = this.now();
    const selectedType = this.selectedType();

    const feedingEvents: HistoryEvent[] =
      this.feedingService
        .feedings()
        .filter(
          (feeding) =>
            feeding.startedAt >= range.start &&
            feeding.startedAt < range.end,
        )
        .map((feeding) =>
          this.createFeedingEvent(
            feeding,
            currentTime,
          ),
        );

    const sleepEvents: HistoryEvent[] =
      this.sleepService
        .sleeps()
        .filter(
          (sleep) =>
            sleep.startedAt >= range.start &&
            sleep.startedAt < range.end,
        )
        .map((sleep) =>
          this.createSleepEvent(
            sleep,
            currentTime,
          ),
        );

    const diaperEvents: HistoryEvent[] =
      this.diaperService
        .diapers()
        .filter(
          (diaper) =>
            diaper.recordedAt >= range.start &&
            diaper.recordedAt < range.end,
        )
        .map((diaper) =>
          this.createDiaperEvent(diaper),
        );

    return [
      ...feedingEvents,
      ...sleepEvents,
      ...diaperEvents,
    ]
      .filter(
        (event) =>
          selectedType === 'all' ||
          event.kind === selectedType,
      )
      .sort(
        (a, b) => b.timestamp - a.timestamp,
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

  selectType(type: HistoryFilter): void {
    this.selectedType.set(type);
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (this.parseDate(value)) {
      this.selectedDate.set(value);
    }
  }

  clearFilters(): void {
    this.selectedDate.set(
      this.dateValue(new Date(this.now())),
    );
    this.selectedType.set('all');
  }

  private createFeedingEvent(
    feeding: Feeding,
    now: number,
  ): HistoryEvent {
    return {
      id: feeding.id,
      kind: 'feeding',
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
      timestamp: feeding.startedAt,
      description: this.feedingDescription(
        feeding,
        now,
      ),
    };
  }

  private createSleepEvent(
    sleep: Sleep,
    now: number,
  ): HistoryEvent {
    return {
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
        now,
      ),
    };
  }

  private createDiaperEvent(
    diaper: Diaper,
  ): HistoryEvent {
    return {
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
    };
  }

  private feedingDescription(
    feeding: Feeding,
    now: number,
  ): string {
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

  private dateValue(date: Date): string {
    const pad = (value: number): string =>
      String(value).padStart(2, '0');

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-');
  }

  private parseDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (
      Number.isNaN(date.getTime()) ||
      this.dateValue(date) !== value
    ) {
      return null;
    }

    return date;
  }

  private dayRange(
    value: string,
  ): { start: number; end: number } | null {
    const date = this.parseDate(value);

    if (!date) {
      return null;
    }

    date.setHours(0, 0, 0, 0);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    return {
      start: date.getTime(),
      end: nextDay.getTime(),
    };
  }
}