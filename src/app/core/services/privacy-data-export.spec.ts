import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';
import { PrivacyDataExportService } from './privacy-data-export';

describe('PrivacyDataExportService', () => {
  let exporter: PrivacyDataExportService;
  let user: ReturnType<typeof signal<User | null>>;
  let activeBabyId: ReturnType<typeof signal<string | null>>;
  let serverReads: Record<string, Record<string, unknown> | null>;
  let serverLists: Record<string, Record<string, unknown>[]>;
  let getFromServer: jasmine.Spy;
  let listFromServer: jasmine.Spy;
  let ensureLoaded: jasmine.Spy;

  beforeEach(() => {
    user = signal<User | null>({ uid: 'user-a', email: 'a@teste.com' } as User);
    activeBabyId = signal<string | null>('baby-a');
    serverReads = {
      'users/user-a': {
        caregiverName: 'Marcelo',
        babyName: 'Lucas',
        consentGiven: true,
        consentAt: '2026-01-01T00:00:00.000Z',
        internalSecret: 'nunca exportar',
      },
      'babies/baby-a/members/user-a': { role: 'owner' },
      'babies/baby-a': { name: 'Lucas', birthDate: '2026-02-01', createdByUid: 'user-a' },
    };
    serverLists = {
      'users/user-a/babies': [{ id: 'baby-a', role: 'owner' }],
      'users/user-a/feedings': [],
      'users/user-a/sleeps': [],
      'users/user-a/diapers': [],
      'users/user-a/notifications': [],
      'babies/baby-a/feedings': [{
        id: 'feeding-a',
        startedAt: 1000,
        endedAt: 2000,
        side: 'left',
        periods: [{ startedAt: 1000, endedAt: 2000, side: 'left' }],
        createdByUid: 'user-a',
        finishedByUid: 'user-b',
        extraSecret: 'nunca exportar',
      }],
      'babies/baby-a/sleeps': [],
      'babies/baby-a/diapers': [{
        id: 'diaper-a',
        type: 'wet',
        recordedAt: 2500,
        createdByUid: 'user-b',
      }],
    };
    getFromServer = jasmine.createSpy('getFromServer').and.callFake(
      async (path: string) => serverReads[path] ?? null,
    );
    listFromServer = jasmine.createSpy('listFromServer').and.callFake(
      async (path: string) => serverLists[path] ?? [],
    );
    ensureLoaded = jasmine.createSpy('ensureLoaded').and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        PrivacyDataExportService,
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
            ensureLoaded,
          },
        },
        {
          provide: FirestoreGateway,
          useValue: { getFromServer, listFromServer },
        },
      ],
    });

    exporter = TestBed.inject(PrivacyDataExportService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('exporta apenas perfil e registros de bebês vinculados', async () => {
    const result = await exporter.collect();

    expect(result.schemaVersion).toBe(1);
    expect(result.account.email).toBe('a@teste.com');
    expect(result.account.profile['caregiverName']).toBe('Marcelo');
    expect(result.account.profile['internalSecret']).toBeUndefined();
    expect(result.babies.length).toBe(1);
    expect(result.babies[0].baby['name']).toBe('Lucas');
    expect(result.babies[0].baby['createdByUid']).toBeUndefined();
    expect(result.babies[0].records.feedings[0]['createdBy']).toBe('propria_conta');
    expect(result.babies[0].records.feedings[0]['finishedBy']).toBe('outro_responsavel');
    expect(result.babies[0].records.feedings[0]['extraSecret']).toBeUndefined();
    expect(result.babies[0].records.diapers[0]['createdBy']).toBe('outro_responsavel');
    expect(listFromServer).not.toHaveBeenCalledWith('babies/baby-inacessivel/feedings');
  });

  it('inclui registros legados ainda associados à própria conta', async () => {
    serverLists['users/user-a/sleeps'] = [{
      id: 'legacy-sleep',
      startedAt: 200,
      endedAt: 500,
    }];

    const result = await exporter.collect();

    expect(result.account.legacy.sleeps[0]['id']).toBe('legacy-sleep');
  });

  it('exporta todos os bebês autorizados, sem buscar outras contas', async () => {
    serverLists['users/user-a/babies'].push({ id: 'baby-b', role: 'caregiver' });
    serverReads['babies/baby-b/members/user-a'] = { role: 'caregiver' };
    serverReads['babies/baby-b'] = { name: 'Lia', birthDate: '2026-04-01' };
    serverLists['babies/baby-b/feedings'] = [];
    serverLists['babies/baby-b/sleeps'] = [];
    serverLists['babies/baby-b/diapers'] = [];

    const result = await exporter.collect();

    expect(result.babies.map((item) => item.baby['id'])).toEqual(['baby-a', 'baby-b']);
    expect(result.babies[1].role).toBe('caregiver');
    expect(getFromServer).not.toHaveBeenCalledWith('users/user-b');
  });

  it('recusa exportar sem autenticação', async () => {
    user.set(null);

    await expectAsync(exporter.collect()).toBeRejectedWithError(
      'É necessário entrar na conta para exportar os dados.',
    );
    expect(getFromServer).not.toHaveBeenCalled();
  });

  it('recusa arquivo parcial quando há bebê ativo ausente no índice', async () => {
    serverLists['users/user-a/babies'] = [];

    await expectAsync(exporter.collect()).toBeRejectedWithError(
      'A lista de bebês está incompleta. Não foi gerado um arquivo parcial.',
    );
  });

  it('interrompe exportação se acesso a um bebê foi revogado', async () => {
    serverReads['babies/baby-a/members/user-a'] = null;

    await expectAsync(exporter.collect()).toBeRejectedWithError(
      'Seu acesso a um dos bebês mudou. Reinicie a exportação.',
    );
    expect(listFromServer).not.toHaveBeenCalledWith('babies/baby-a/feedings');
  });

  it('interrompe exportação se a conta muda durante a leitura', async () => {
    getFromServer.and.callFake(async (path: string) => {
      if (path === 'users/user-a') {
        user.set({ uid: 'user-b', email: 'b@teste.com' } as User);
      }

      return serverReads[path] ?? null;
    });

    await expectAsync(exporter.collect()).toBeRejectedWithError(
      'A conta mudou durante a exportação. Nenhum arquivo foi gerado.',
    );
    expect(listFromServer).not.toHaveBeenCalled();
  });

  it('não usa cache quando a conexão com o servidor falha', async () => {
    listFromServer.and.rejectWith(new Error('unavailable'));

    await expectAsync(exporter.collect()).toBeRejected();
    expect(listFromServer).toHaveBeenCalledWith('users/user-a/babies');
  });
});
