import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';
import { FeedingV2Reader } from './feeding-v2-reader';

describe('FeedingV2Reader', () => {
  let reader: FeedingV2Reader;
  let user: ReturnType<typeof signal<User | null>>;
  let getFromServer: jasmine.Spy;
  let listFromServer: jasmine.Spy;

  const parent = {
    id: 'feeding-v2',
    storageVersion: 2,
    startedAt: 1000,
    endedAt: 1800,
    side: 'right',
    periodCount: 8,
    lastPeriodId: '00000007',
    lastPeriodStartedAt: 1700,
    createdByUid: 'user-a',
  };
  const periods = Array.from({ length: 8 }, (_, index) => ({
    id: String(index).padStart(8, '0'),
    index,
    startedAt: 1000 + index * 100,
    endedAt: 1100 + index * 100,
    side: index % 2 === 0 ? 'left' : 'right',
  }));

  beforeEach(() => {
    user = signal<User | null>({ uid: 'user-a' } as User);
    getFromServer = jasmine.createSpy('getFromServer').and.resolveTo({ ...parent });
    listFromServer = jasmine.createSpy('listFromServer').and.resolveTo(periods);

    TestBed.configureTestingModule({
      providers: [
        FeedingV2Reader,
        { provide: AuthService, useValue: { user: user.asReadonly() } },
        { provide: FirestoreGateway, useValue: { getFromServer, listFromServer } },
      ],
    });
    reader = TestBed.inject(FeedingV2Reader);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('preserva v1 e hidrata oito períodos v2 do servidor', async () => {
    const old = { id: 'feeding-v1', periods: null, startedAt: 200, endedAt: 400, side: 'left' as const };
    const result = await reader.hydrate('baby-a', [old, parent]);

    expect(result[0]).toEqual(old);
    expect(result[1].storageVersion).toBe(2);
    expect(result[1].periods?.length).toBe(8);
    expect(result[1].periods?.[7].side).toBe('right');
    expect(getFromServer).toHaveBeenCalledOnceWith('babies/baby-a/feedings/feeding-v2');
    expect(listFromServer).toHaveBeenCalledOnceWith('babies/baby-a/feedings/feeding-v2/periods');
  });

  it('não consulta a nuvem quando só existem registros v1', async () => {
    const old = { id: 'old-feeding', startedAt: 1000, endedAt: 1200, side: null, periods: null };
    expect(reader.hasVersioned([old])).toBeFalse();
    expect(await reader.hydrate('baby-a', [old])).toEqual([old]);
    expect(getFromServer).not.toHaveBeenCalled();
    expect(listFromServer).not.toHaveBeenCalled();
  });

  it('recusa lista de períodos incompleta e falha offline', async () => {
    listFromServer.and.resolveTo(periods.slice(0, -1));

    await expectAsync(reader.hydrate('baby-a', [parent])).toBeRejectedWithError(
      'A lista de períodos está incompleta ou possui elementos extras.',
    );

    listFromServer.and.rejectWith(new Error('offline'));

    await expectAsync(reader.hydrate('baby-a', [parent])).toBeRejected();
  });

  it('recusa resumos diferentes entre snapshot e servidor', async () => {
    getFromServer.and.resolveTo({ ...parent, periodCount: 9 });

    await expectAsync(reader.hydrate('baby-a', [parent])).toBeRejectedWithError(
      'A mamada mudou durante a consulta. Tente sincronizar novamente.',
    );
  });

  it('recusa versões desconhecidas sem exportar histórico parcial', async () => {
    await expectAsync(reader.hydrate('baby-a', [
      { id: 'feeding-v3', storageVersion: 3 },
    ])).toBeRejectedWithError('Foi encontrada uma versão de mamada não suportada.');
    expect(getFromServer).not.toHaveBeenCalled();
  });

  it('interrompe a consulta quando a conta muda durante a leitura', async () => {
    getFromServer.and.callFake(async () => {
      user.set({ uid: 'user-b' } as User);
      return { ...parent };
    });

    await expectAsync(reader.hydrate('baby-a', [parent])).toBeRejectedWithError(
      'A conta mudou durante o carregamento das mamadas.',
    );
  });
});
