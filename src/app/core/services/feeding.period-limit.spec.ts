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

  it('impede criar o período 7 sem modificar a amamentação aberta', async () => {
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

  it('preserva uma amamentação legada acima do limite sem tentar regravar ou finalizar', async () => {
    const original = ongoingFeeding(MAX_FEEDING_PERIODS + 1);
    feedings.set([original]);

    expect(service.legacyOversized()).toBeTrue();
    expect(service.periodLimitReached()).toBeTrue();
    expect(await service.setSide('right')).toBeFalse();
    expect(await service.finish()).toBeNull();
    expect(saveFeeding).not.toHaveBeenCalled();
    expect(service.activeFeeding()).toEqual(original);
  });

  it('bloqueia edição de amamentação legada concluída acima do limite', async () => {
    const completed: Feeding = {
      ...ongoingFeeding(MAX_FEEDING_PERIODS + 1),
      endedAt: 1800,
      periods: ongoingFeeding(MAX_FEEDING_PERIODS + 1).periods?.map((period, index, array) =>
        index === array.length - 1 ? { ...period, endedAt: 1800 } : period,
      ) ?? null,
    };
    feedings.set([completed]);

    expect(await service.updateCompleted(completed)).toBeFalse();
    expect(saveFeeding).not.toHaveBeenCalled();
    expect(service.feedings()[0].periods?.length).toBe(MAX_FEEDING_PERIODS + 1);
  });

  it('permite adicionar o último período autorizado', async () => {
    feedings.set([ongoingFeeding(MAX_FEEDING_PERIODS - 1)]);

    expect(service.periodLimitReached()).toBeFalse();
    expect(await service.setSide('right')).toBeTrue();
    expect(service.activeFeeding()?.periods?.length).toBe(MAX_FEEDING_PERIODS);
    expect(service.periodLimitReached()).toBeTrue();
  });

  it('registra mamadeira concluída e impede repetição no mesmo horário', async () => {
    feedings.set([]);
    const recordedAt = Date.now();

    const bottle = await service.registerBottle(120, recordedAt);

    expect(bottle).toEqual(jasmine.objectContaining({
      startedAt: recordedAt, endedAt: recordedAt,
      side: null, periods: null, bottleMl: 120,
    }));
    expect(await service.registerBottle(120, recordedAt)).toBeNull();
    expect(saveFeeding).toHaveBeenCalledTimes(1);
    expect(await service.registerBottle(0, recordedAt)).toBeNull();
    expect(saveFeeding).toHaveBeenCalledTimes(1);
  });
});
