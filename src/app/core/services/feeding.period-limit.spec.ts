import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAX_FEEDING_PERIODS, type Feeding } from '../models/feeding';
import { ActivityPersistenceService } from './activity-persistence';
import { FeedingService } from './feeding';

describe('FeedingService: limite de períodos', () => {
  let service: FeedingService;
  let feedings: ReturnType<typeof signal<Feeding[]>>;
  let saveFeeding: jasmine.Spy;

  function ongoingFeeding(count: number): Feeding {
    return {
      id: 'feeding-long',
      startedAt: 1000,
      endedAt: null,
      side: 'left',
      periods: Array.from({ length: count }, (_, index) => ({
        startedAt: 1000 + index * 100,
        endedAt: index === count - 1 ? null : 1100 + index * 100,
        side: 'left' as const,
      })),
    };
  }

  beforeEach(() => {
    feedings = signal<Feeding[]>([ongoingFeeding(MAX_FEEDING_PERIODS)]);
    saveFeeding = jasmine.createSpy('saveFeeding').and.callFake(async (feeding: Feeding) => {
      feedings.set([feeding]);
    });

    TestBed.configureTestingModule({
      providers: [
        FeedingService,
        {
          provide: ActivityPersistenceService,
          useValue: {
            feedings: feedings.asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            isReady: signal(true).asReadonly(),
            isLoading: signal(false).asReadonly(),
            load: jasmine.createSpy('load').and.resolveTo(),
            saveFeeding,
          },
        },
      ],
    });

    service = TestBed.inject(FeedingService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('impede criar o período 7 sem modificar a mamada aberta', async () => {
    expect(service.periodLimitReached()).toBeTrue();
    expect(await service.setSide('right')).toBeFalse();
    expect(saveFeeding).not.toHaveBeenCalled();
    expect(service.activeFeeding()?.periods?.length).toBe(MAX_FEEDING_PERIODS);
  });

  it('permite finalizar mesmo depois de atingir o limite', async () => {
    const completed = await service.finish();

    expect(completed?.endedAt).not.toBeNull();
    expect(completed?.periods?.length).toBe(MAX_FEEDING_PERIODS);
    expect(saveFeeding).toHaveBeenCalledTimes(1);
  });

  it('permite adicionar o último período autorizado', async () => {
    feedings.set([ongoingFeeding(MAX_FEEDING_PERIODS - 1)]);

    expect(service.periodLimitReached()).toBeFalse();
    expect(await service.setSide('right')).toBeTrue();
    expect(service.activeFeeding()?.periods?.length).toBe(MAX_FEEDING_PERIODS);
    expect(service.periodLimitReached()).toBeTrue();
  });
});
