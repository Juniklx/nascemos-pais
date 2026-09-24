import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { ActivityPersistenceService } from './activity-persistence';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';
import { BabyDataRepository } from './baby-data.repository';
import { FeedingV2Reader } from './feeding-v2-reader';
import { UserDataRepository } from './user-data.repository';

describe('ActivityPersistenceService', () => {
  const feedingKey = 'nascemos-pais:feedings:v2';
  const legacyFeedingKey = 'nascemos-pais:feedings:v1';
  const sleepKey = 'nascemos-pais:sleeps:v1';
  const diaperKey = 'nascemos-pais:diapers:v1';

  let service: ActivityPersistenceService;
  let user: ReturnType<typeof signal<User | null>>;
  let activeBabyId: ReturnType<typeof signal<string | null>>;

  let repository: {
    readProfile: jasmine.Spy;
    listRecords: jasmine.Spy;
    saveRecords: jasmine.Spy;
    saveProfile: jasmine.Spy;
    saveRecord: jasmine.Spy;
    deleteRecord: jasmine.Spy;
  };

  let babies: {
    listRecords: jasmine.Spy;
    saveRecord: jasmine.Spy;
    deleteRecord: jasmine.Spy;
    watchRecords: jasmine.Spy;
    watchMembers: jasmine.Spy;
  };

  let feedingV2Reader: { hasVersioned: jasmine.Spy; hydrate: jasmine.Spy };

  let streams: Array<{
    babyId: string;
    collectionName: string;
    next: (records: unknown[], fromCache: boolean, hasPendingWrites: boolean) => void;
    error: (error: Error) => void;
    unsubscribe: jasmine.Spy;
  }>;

  let babyContext: {
    ensureLoaded: jasmine.Spy;
  };

  const feeding = {
    id: 'feeding-1',
    startedAt: 1000,
    endedAt: null,
    side: 'left' as const,
    periods: [
      {
        startedAt: 1000,
        endedAt: null,
        side: 'left' as const,
      },
    ],
  };

  const sleep = {
    id: 'sleep-1',
    startedAt: 2000,
    endedAt: 3000,
  };

  const diaper = {
    id: 'diaper-1',
    type: 'wet' as const,
    recordedAt: 4000,
  };

  function mockLegacyCloud(
    value: {
      feedings?: readonly unknown[];
      sleeps?: readonly unknown[];
      diapers?: readonly unknown[];
    } = {},
  ): void {
    repository.listRecords.and.callFake(async (collectionName: string) => {
      switch (collectionName) {
        case 'feedings':
          return [...(value.feedings ?? [])];

        case 'sleeps':
          return [...(value.sleeps ?? [])];

        case 'diapers':
          return [...(value.diapers ?? [])];

        default:
          return [];
      }
    });
  }

  function mockBabyCloud(
    value: {
      feedings?: readonly unknown[];
      sleeps?: readonly unknown[];
      diapers?: readonly unknown[];
    } = {},
  ): void {
    babies.listRecords.and.callFake(async (_babyId: string, collectionName: string) => {
      switch (collectionName) {
        case 'feedings':
          return [...(value.feedings ?? [])];

        case 'sleeps':
          return [...(value.sleeps ?? [])];

        case 'diapers':
          return [...(value.diapers ?? [])];

        default:
          return [];
      }
    });
  }

  beforeEach(() => {
    localStorage.clear();

    user = signal<User | null>({
      uid: 'user-a',
    } as User);

    activeBabyId = signal<string | null>('baby-a');

    repository = jasmine.createSpyObj('UserDataRepository', [
      'readProfile',
      'listRecords',
      'saveRecords',
      'saveProfile',
      'saveRecord',
      'deleteRecord',
    ]);

    babies = jasmine.createSpyObj('BabyDataRepository', [
      'listRecords',
      'saveRecord',
      'deleteRecord',
      'watchRecords',
      'watchMembers',
    ]);

    streams = [];
    feedingV2Reader = {
      hasVersioned: jasmine.createSpy('hasVersioned').and.callFake((records: unknown[]) =>
        records.some((record) => typeof record === 'object' && record !== null &&
          'storageVersion' in record),
      ),
      hydrate: jasmine.createSpy('hydrate').and.resolveTo([]),
    };

    babies.watchRecords.and.callFake(
      (babyId: string, collectionName: string,
        next: (records: unknown[], fromCache: boolean, hasPendingWrites: boolean) => void,
        error: (error: Error) => void) => {
        const unsubscribe = jasmine.createSpy('unsubscribe');
        streams.push({ babyId, collectionName, next, error, unsubscribe });
        return unsubscribe;
      },
    );
    babies.watchMembers.and.returnValue(jasmine.createSpy('unsubscribeMembers'));

    babyContext = {
      ensureLoaded: jasmine.createSpy('ensureLoaded'),
    };

    repository.readProfile.and.resolveTo({
      recordsMigrationVersion: 1,
    });

    mockLegacyCloud();

    repository.saveRecords.and.resolveTo();
    repository.saveProfile.and.resolveTo();
    repository.saveRecord.and.resolveTo();
    repository.deleteRecord.and.resolveTo();

    mockBabyCloud();

    babies.saveRecord.and.resolveTo();
    babies.deleteRecord.and.resolveTo();

    babyContext.ensureLoaded.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        ActivityPersistenceService,
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
            waitUntilReady: jasmine.createSpy('waitUntilReady').and.resolveTo(),
          },
        },
        {
          provide: BabyContextService,
          useValue: {
            activeBabyId: activeBabyId.asReadonly(),
            ensureLoaded: babyContext.ensureLoaded,
          },
        },
        {
          provide: BabyDataRepository,
          useValue: babies,
        },
        {
          provide: UserDataRepository,
          useValue: repository,
        },
        { provide: FeedingV2Reader, useValue: feedingV2Reader },
      ],
    });

    service = TestBed.inject(ActivityPersistenceService);
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('migra registros locais antes de carregar os registros do bebê', async () => {
    repository.readProfile.and.resolveTo({});

    localStorage.setItem(feedingKey, JSON.stringify([feeding]));
    localStorage.setItem(sleepKey, JSON.stringify([sleep]));
    localStorage.setItem(diaperKey, JSON.stringify([diaper]));

    /*
     * No ambiente real, BabyMigrationService copia
     * estes registros para o bebê durante ensureLoaded().
     */
    mockBabyCloud({
      feedings: [feeding],
      sleeps: [sleep],
      diapers: [diaper],
    });

    const result = await service.load();

    expect(repository.saveRecords).toHaveBeenCalledWith('feedings', [feeding]);

    expect(repository.saveRecords).toHaveBeenCalledWith('sleeps', [sleep]);

    expect(repository.saveRecords).toHaveBeenCalledWith('diapers', [diaper]);

    expect(repository.saveProfile).toHaveBeenCalledWith(
      jasmine.objectContaining({
        recordsMigrationVersion: 1,
      }),
    );

    expect(babyContext.ensureLoaded).toHaveBeenCalledTimes(1);

    expect(babies.listRecords).toHaveBeenCalledWith('baby-a', 'feedings');

    expect(result.feedings).toEqual([feeding]);
    expect(result.sleeps).toEqual([sleep]);
    expect(result.diapers).toEqual([diaper]);

    expect(localStorage.getItem(feedingKey)).toBeNull();
    expect(localStorage.getItem(sleepKey)).toBeNull();
    expect(localStorage.getItem(diaperKey)).toBeNull();
  });

  it('não remigra dados locais depois que a migração legada foi concluída', async () => {
    repository.readProfile.and.resolveTo({
      recordsMigrationVersion: 1,
    });

    mockBabyCloud({
      feedings: [feeding],
      sleeps: [sleep],
      diapers: [diaper],
    });

    localStorage.setItem(
      feedingKey,
      JSON.stringify([
        {
          ...feeding,
          id: 'stale',
        },
      ]),
    );

    const result = await service.load();

    expect(result.feedings[0].id).toBe('feeding-1');

    expect(repository.saveRecords).not.toHaveBeenCalled();

    expect(babies.listRecords).toHaveBeenCalledWith('baby-a', 'feedings');

    expect(localStorage.getItem(feedingKey)).toBeNull();
  });

  it('mantém os dados locais quando a migração legada falha', async () => {
    repository.readProfile.and.resolveTo({});

    localStorage.setItem(feedingKey, JSON.stringify([feeding]));

    repository.saveRecords.and.rejectWith(new Error('Firestore indisponível'));

    await expectAsync(service.load()).toBeRejected();

    expect(localStorage.getItem(feedingKey)).not.toBeNull();
    expect(repository.saveProfile).not.toHaveBeenCalled();
    expect(babyContext.ensureLoaded).not.toHaveBeenCalled();
    expect(service.isReady()).toBeFalse();
    expect(service.error()).not.toBeNull();
  });

  it('converte mamadas da versão antiga antes da migração para o bebê', async () => {
    repository.readProfile.and.resolveTo({});

    localStorage.setItem(
      legacyFeedingKey,
      JSON.stringify([
        {
          id: 'legacy-feeding',
          startedAt: 1000,
          endedAt: 2000,
          side: 'right',
        },
      ]),
    );

    const converted = {
      id: 'legacy-feeding',
      startedAt: 1000,
      endedAt: 2000,
      side: 'right' as const,
      periods: null,
    };

    mockBabyCloud({
      feedings: [converted],
    });

    const result = await service.load();

    expect(repository.saveRecords).toHaveBeenCalledWith('feedings', [converted]);

    expect(result.feedings[0]).toEqual(converted);
  });

  it('não apaga armazenamento local inválido', async () => {
    repository.readProfile.and.resolveTo({});

    localStorage.setItem(feedingKey, '{inválido');

    await expectAsync(service.load()).toBeRejected();

    expect(localStorage.getItem(feedingKey)).toBe('{inválido');
    expect(repository.saveProfile).not.toHaveBeenCalled();
    expect(babyContext.ensureLoaded).not.toHaveBeenCalled();
    expect(service.error()).toContain('não foram apagados');
  });

  it('carrega os registros do bebê ativo por sinais reativos', async () => {
    mockBabyCloud({
      feedings: [feeding],
      sleeps: [sleep],
      diapers: [diaper],
    });

    expect(service.isReady()).toBeFalse();

    await service.load();

    expect(service.isReady()).toBeTrue();
    expect(service.isLoading()).toBeFalse();
    expect(service.error()).toBeNull();

    expect(service.feedings()).toEqual([feeding]);
    expect(service.sleeps()).toEqual([sleep]);
    expect(service.diapers()).toEqual([diaper]);

    expect(babies.listRecords).toHaveBeenCalledWith('baby-a', 'feedings');

    expect(babies.listRecords).toHaveBeenCalledWith('baby-a', 'sleeps');

    expect(babies.listRecords).toHaveBeenCalledWith('baby-a', 'diapers');
  });

  it('carrega registros compartilhados antigos com atividades simultâneas', async () => {
    const secondFeeding = {
      id: 'feeding-2',
      startedAt: 2000,
      endedAt: null,
      side: 'right' as const,
      periods: [
        {
          startedAt: 2000,
          endedAt: null,
          side: 'right' as const,
        },
      ],
    };

    const firstSleep = {
      id: 'sleep-open-1',
      startedAt: 3000,
      endedAt: null,
    };

    const secondSleep = {
      id: 'sleep-open-2',
      startedAt: 4000,
      endedAt: null,
    };

    mockBabyCloud({
      feedings: [feeding, secondFeeding],
      sleeps: [firstSleep, secondSleep],
    });

    const result = await service.load();

    expect(result.feedings.length).toBe(2);
    expect(result.sleeps.length).toBe(2);
    expect(service.isReady()).toBeTrue();
    expect(service.error()).toBeNull();
  });

  it('salva mamada no bebê ativo e atualiza o estado', async () => {
    await service.load();

    await service.saveFeeding(feeding);

    expect(babies.saveRecord).toHaveBeenCalledOnceWith('baby-a', 'feedings', { ...feeding, createdByUid: 'user-a' });

    expect(repository.saveRecord).not.toHaveBeenCalled();

    expect(service.feedings()).toEqual([{ ...feeding, createdByUid: 'user-a' }]);

    const cached = await service.load();

    expect(cached.feedings).toEqual([{ ...feeding, createdByUid: 'user-a' }]);
  });

  it('bloqueia gravações de mamadas antigas acima do limite sem alterar o histórico', async () => {
    const old = {
      ...feeding,
      endedAt: 1700,
      side: 'left' as const,
      periods: Array.from({ length: 7 }, (_, index) => ({
        startedAt: 1000 + index * 100,
        endedAt: 1100 + index * 100,
        side: 'left' as const,
      })),
    };
    mockBabyCloud({ feedings: [old] });
    await service.load();

    await expectAsync(service.saveFeeding({ ...old, side: 'right' })).toBeRejectedWithError(
      'Este registro possui mais de 6 períodos e deve ser migrado sem perda de dados.',
    );

    expect(babies.saveRecord).not.toHaveBeenCalled();
    expect(service.feedings()[0].periods).toEqual(old.periods);
  });

  it('salva sono e fralda no bebê ativo', async () => {
    await service.load();

    await service.saveSleep(sleep);
    await service.saveDiaper(diaper);

    expect(babies.saveRecord).toHaveBeenCalledWith('baby-a', 'sleeps', { ...sleep, createdByUid: 'user-a' });

    expect(babies.saveRecord).toHaveBeenCalledWith('baby-a', 'diapers', { ...diaper, createdByUid: 'user-a' });

    expect(service.sleeps()).toEqual([{ ...sleep, createdByUid: 'user-a' }]);
    expect(service.diapers()).toEqual([{ ...diaper, createdByUid: 'user-a' }]);
  });

  it('remove registro do bebê ativo e atualiza o estado', async () => {
    mockBabyCloud({
      feedings: [feeding],
    });

    await service.load();

    expect(service.feedings()).toEqual([feeding]);

    await service.deleteFeeding(feeding.id);

    expect(babies.deleteRecord).toHaveBeenCalledOnceWith('baby-a', 'feedings', feeding.id);

    expect(repository.deleteRecord).not.toHaveBeenCalled();
    expect(service.feedings()).toEqual([]);
  });

  it('não altera o estado quando uma gravação no bebê falha', async () => {
    await service.load();

    babies.saveRecord.and.rejectWith(new Error('Firestore indisponível'));

    await expectAsync(service.saveFeeding(feeding)).toBeRejected();

    expect(service.feedings()).toEqual([]);
    expect(service.error()).toContain('sincronizar');
    expect(service.isReady()).toBeTrue();
  });

  it('permite tentar novamente depois de falha ao carregar o contexto do bebê', async () => {
    babyContext.ensureLoaded.and.rejectWith(new Error('Firestore indisponível'));

    await expectAsync(service.load()).toBeRejected();

    expect(service.isReady()).toBeFalse();
    expect(service.error()).not.toBeNull();

    babyContext.ensureLoaded.and.resolveTo();

    mockBabyCloud({
      feedings: [feeding],
    });

    const result = await service.load();

    expect(result.feedings).toEqual([feeding]);
    expect(service.isReady()).toBeTrue();
    expect(service.error()).toBeNull();
  });

  it('aplica em tempo real inclusões e exclusões vindas do Firestore', async () => {
    await service.load();

    const feedingStream = streams.find((item) => item.collectionName === 'feedings')!;
    const diaperStream = streams.find((item) => item.collectionName === 'diapers')!;

    feedingStream.next([feeding], false, false);
    diaperStream.next([diaper], false, false);
    streams.find((item) => item.collectionName === 'sleeps')!.next([], false, false);

    expect(service.feedings()).toEqual([feeding]);
    expect(service.diapers()).toEqual([diaper]);
    expect(service.realtimeStatus()).toBe('live');

    // Ao perder a ligação com o servidor, os dados em cache continuam disponíveis.
    diaperStream.next([diaper], true, false);
    expect(service.realtimeStatus()).toBe('connecting');
    expect(service.diapers()).toEqual([diaper]);

    diaperStream.next([diaper], false, false);
    expect(service.realtimeStatus()).toBe('live');

    feedingStream.next([], false, false);

    expect(service.feedings()).toEqual([]);
    expect(service.diapers()).toEqual([diaper]);
  });

  it('ignora snapshots locais ainda não confirmados pelo servidor', async () => {
    await service.load();

    streams.find((item) => item.collectionName === 'feedings')!.next([feeding], true, true);

    expect(service.feedings()).toEqual([]);
    expect(service.realtimeStatus()).toBe('connecting');
  });

  it('encerra os listeners anteriores e ignora eventos de outro bebê', async () => {
    await service.load();

    const oldStreams = [...streams];
    activeBabyId.set('baby-b');
    mockBabyCloud();

    await service.load();

    for (const previous of oldStreams) {
      expect(previous.unsubscribe).toHaveBeenCalled();
    }

    oldStreams[0].next([feeding], false, false);

    expect(service.feedings()).toEqual([]);
    expect(streams.filter((stream) => stream.babyId === 'baby-b').length).toBe(3);
  });

  it('preserva os registros se um listener falha e permite reconectar', async () => {
    mockBabyCloud({ feedings: [feeding] });
    await service.load();

    streams[0].error(new Error('permission-denied'));

    expect(service.feedings()).toEqual([feeding]);
    expect(service.error()).toContain('sincronizar');
    expect(service.realtimeStatus()).toBe('error');
    expect(streams[0].unsubscribe).toHaveBeenCalled();

    service.retryRealtime();

    expect(streams.filter((stream) => stream.collectionName === 'feedings').length).toBe(2);
    expect(service.realtimeStatus()).toBe('connecting');
  });

  it('hidrata mamadas v2 no carregamento inicial e bloqueia alterações prematuras', async () => {
    const parent = { id: 'feeding-v2', storageVersion: 2, periodCount: 1 };
    const hydrated = {
      id: 'feeding-v2', storageVersion: 2 as const, startedAt: 1000, endedAt: 1200,
      side: 'left' as const, periods: [{ startedAt: 1000, endedAt: 1200, side: 'left' as const }],
    };
    mockBabyCloud({ feedings: [parent] });
    feedingV2Reader.hydrate.and.resolveTo([hydrated]);

    const result = await service.load();

    expect(feedingV2Reader.hydrate).toHaveBeenCalledWith('baby-a', [parent]);
    expect(result.feedings[0].storageVersion).toBe(2);
    await expectAsync(service.saveFeeding(hydrated)).toBeRejectedWithError(
      'Mamadas v2 estão disponíveis apenas para leitura nesta versão.',
    );
    await expectAsync(service.deleteFeeding('feeding-v2')).toBeRejectedWithError(
      'A exclusão de mamadas v2 ainda não está disponível.',
    );
    expect(babies.saveRecord).not.toHaveBeenCalled();
    expect(babies.deleteRecord).not.toHaveBeenCalled();
  });

  it('recusa carregamento parcial quando faltam períodos v2', async () => {
    mockBabyCloud({ feedings: [{ id: 'feeding-v2', storageVersion: 2 }] });
    feedingV2Reader.hydrate.and.rejectWith(new Error('períodos incompletos'));

    await expectAsync(service.load()).toBeRejected();

    expect(service.feedings()).toEqual([]);
    expect(service.isReady()).toBeFalse();
    expect(service.error()).toContain('Não foi possível carregar');
  });

  it('ignora hidratação v2 antiga que chega após snapshot mais recente', async () => {
    await service.load();
    const stream = streams.find((item) => item.collectionName === 'feedings')!;
    const parent = { id: 'feeding-v2', storageVersion: 2 };
    const finished = {
      id: 'feeding-v2', storageVersion: 2 as const, startedAt: 1000, endedAt: 1300,
      side: 'right' as const, periods: [{ startedAt: 1000, endedAt: 1300, side: 'right' as const }],
    };
    let resolveSlow!: (value: unknown[]) => void;
    const slow = new Promise<unknown[]>((resolve) => { resolveSlow = resolve; });
    feedingV2Reader.hydrate.and.returnValues(slow, Promise.resolve([finished]));

    stream.next([parent], false, false);
    stream.next([parent], false, false);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.feedings()[0].endedAt).toBe(1300);

    resolveSlow([{ ...finished, endedAt: 1100, periods: [
      { startedAt: 1000, endedAt: 1100, side: 'right' as const },
    ] }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.feedings()[0].endedAt).toBe(1300);
  });

  it('não consulta filhos v2 com snapshots recebidos somente do cache', async () => {
    await service.load();
    const stream = streams.find((item) => item.collectionName === 'feedings')!;

    stream.next([{ id: 'feeding-v2', storageVersion: 2 }], true, false);

    expect(feedingV2Reader.hydrate).not.toHaveBeenCalled();
    expect(service.feedings()).toEqual([]);
    expect(service.realtimeStatus()).toBe('connecting');
  });

  it('identifica responsáveis e usa fallback para registros legados', async () => {
    await service.load();

    expect(service.actorName()).toBeNull();
    expect(service.actorName('user-a')).toBe('Responsável');

    const onMembers = babies.watchMembers.calls.mostRecent().args[1] as (
      members: Array<{ uid: string; role: 'owner' | 'caregiver'; joinedAt: string; caregiverName?: string }>
    ) => void;

    onMembers([
      { uid: 'user-a', role: 'owner', joinedAt: '2026-01-01', caregiverName: 'Marcelo' },
      { uid: 'user-b', role: 'caregiver', joinedAt: '2026-01-02', caregiverName: 'Ana' },
    ]);

    expect(service.actorName('user-a')).toBe('Marcelo');
    expect(service.actorName('user-b')).toBe('Ana');
    expect(service.actorName('user-c')).toBe('Responsável');
  });

  it('cancela todas as assinaturas ao encerrar a sessão', async () => {
    await service.load();
    const oldStreams = [...streams];

    user.set(null);
    activeBabyId.set(null);

    await expectAsync(service.load()).toBeRejectedWithError('Usuário não autenticado.');

    for (const previous of oldStreams) {
      expect(previous.unsubscribe).toHaveBeenCalled();
    }

    expect(service.realtimeStatus()).toBe('idle');
    expect(service.actorName('user-a')).toBe('Responsável');
  });

  it('registra autoria e preserva o autor de uma atividade existente', async () => {
    mockBabyCloud({ feedings: [feeding] });
    await service.load();

    await service.saveFeeding({ ...feeding, endedAt: 3000, periods: [{
      startedAt: 1000, endedAt: 3000, side: 'left',
    }] });

    expect(babies.saveRecord).toHaveBeenCalledWith('baby-a', 'feedings', jasmine.objectContaining({
      finishedByUid: 'user-a',
    }));
    expect(service.feedings()[0].createdByUid).toBeUndefined();
    expect(service.feedings()[0].finishedByUid).toBe('user-a');
  });

  it('não expõe registros da conta anterior depois da troca de usuário', async () => {
    mockBabyCloud({
      feedings: [feeding],
    });

    await service.load();

    expect(service.feedings()).toEqual([feeding]);

    user.set({
      uid: 'user-b',
    } as User);

    activeBabyId.set(null);

    expect(service.feedings()).toEqual([]);
    expect(service.sleeps()).toEqual([]);
    expect(service.diapers()).toEqual([]);
    expect(service.isReady()).toBeFalse();
    expect(service.error()).toBeNull();

    activeBabyId.set('baby-b');

    mockBabyCloud();

    await service.load();

    expect(service.isReady()).toBeTrue();
    expect(service.feedings()).toEqual([]);

    expect(babies.listRecords).toHaveBeenCalledWith('baby-b', 'feedings');
  });

  it('não expõe registros do bebê anterior quando o bebê ativo muda', async () => {
    mockBabyCloud({
      feedings: [feeding],
    });

    await service.load();

    expect(service.feedings()).toEqual([feeding]);

    activeBabyId.set('baby-b');

    expect(service.feedings()).toEqual([]);
    expect(service.sleeps()).toEqual([]);
    expect(service.diapers()).toEqual([]);
    expect(service.isReady()).toBeFalse();
  });
});
