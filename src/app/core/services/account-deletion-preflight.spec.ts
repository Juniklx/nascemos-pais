import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AccountDeletionPreflightService } from './account-deletion-preflight';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';

describe('AccountDeletionPreflightService', () => {
  let preflight: AccountDeletionPreflightService;
  let user: ReturnType<typeof signal<User | null>>;
  let contextError: ReturnType<typeof signal<string | null>>;
  let reads: Record<string, Record<string, unknown> | null>;
  let lists: Record<string, Record<string, unknown>[]>;
  let getFromServer: jasmine.Spy;
  let listFromServer: jasmine.Spy;

  beforeEach(() => {
    user = signal<User | null>({ uid: 'user-a' } as User);
    contextError = signal<string | null>(null);
    reads = {
      'users/user-a': { caregiverName: 'Responsável A' },
      'babies/baby-a': { name: 'Bebê A' },
      'babies/baby-b': { name: 'Bebê B' },
      'babies/baby-a/members/user-a': { role: 'owner' },
      'babies/baby-b/members/user-a': { role: 'caregiver' },
    };
    lists = {
      'users/user-a/babies': [
        { id: 'baby-a', role: 'owner' },
        { id: 'baby-b', role: 'caregiver' },
      ],
      'babies/baby-a/members': [
        { id: 'user-a', role: 'owner' },
        { id: 'user-b', role: 'caregiver' },
      ],
      'babies/baby-b/members': [
        { id: 'user-c', role: 'owner' },
        { id: 'user-a', role: 'caregiver' },
      ],
    };
    getFromServer = jasmine.createSpy('getFromServer').and.callFake(
      async (path: string) => reads[path] ?? null,
    );
    listFromServer = jasmine.createSpy('listFromServer').and.callFake(
      async (path: string) => lists[path] ?? [],
    );

    TestBed.configureTestingModule({
      providers: [
        AccountDeletionPreflightService,
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
            ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),
            activeBabyId: signal('baby-a').asReadonly(),
            linkedBabies: signal([{ baby: { id: 'baby-a' } }, { baby: { id: 'baby-b' } }]).asReadonly(),
            error: contextError.asReadonly(),
          },
        },
        {
          provide: FirestoreGateway,
          useValue: { getFromServer, listFromServer },
        },
      ],
    });

    preflight = TestBed.inject(AccountDeletionPreflightService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('identifica proprietario e responsavel sem expor outros usuarios', async () => {
    const result = await preflight.preview();

    expect(result.requiresOwnerDecision).toBeTrue();
    expect(result.babies).toEqual([
      { id: 'baby-a', name: 'Bebê A', role: 'owner', otherCaregivers: 1 },
      { id: 'baby-b', name: 'Bebê B', role: 'caregiver', otherCaregivers: 1 },
    ]);
    expect(JSON.stringify(result)).not.toContain('user-b');
    expect(JSON.stringify(result)).not.toContain('user-c');
  });

  it('recusa usuario sem autenticacao', async () => {
    user.set(null);

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'Entre na conta para verificar seus vínculos.',
    );
    expect(getFromServer).not.toHaveBeenCalled();
  });

  it('nao apresenta lista parcial se a consulta ao servidor falhar', async () => {
    listFromServer.and.rejectWith(new Error('offline'));

    await expectAsync(preflight.preview()).toBeRejected();
  });

  it('recusa um indice incompleto ou inconsistente', async () => {
    lists['users/user-a/babies'] = [{ id: 'baby-a', role: 'owner' }];

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'A lista de bebês está incompleta. A pré-verificação foi cancelada.',
    );
  });

  it('recusa permissao divergente entre indice e vinculo', async () => {
    reads['babies/baby-a/members/user-a'] = { role: 'caregiver' };

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'Há divergência de permissões. A pré-verificação foi cancelada.',
    );
  });

  it('recusa dados inconsistentes com mais de um proprietario', async () => {
    lists['babies/baby-a/members'].push({ id: 'user-c', role: 'owner' });

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'A propriedade de um bebê está inconsistente. Solicite ajuda.',
    );
  });

  it('recusa acesso removido durante a consulta', async () => {
    reads['babies/baby-b/members/user-a'] = null;

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'Seu vínculo com um bebê mudou. Reinicie a pré-verificação.',
    );
  });

  it('recusa conclusao quando um vinculo muda na segunda verificacao', async () => {
    let count = 0;

    getFromServer.and.callFake(async (path: string) => {
      if (path === 'babies/baby-a/members/user-a' && ++count === 2) {
        return null;
      }

      return reads[path] ?? null;
    });

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'Seu vínculo mudou. Reinicie a pré-verificação.',
    );
  });

  it('interrompe quando a conta muda durante a leitura', async () => {
    getFromServer.and.callFake(async (path: string) => {
      if (path === 'users/user-a') {
        user.set({ uid: 'user-b' } as User);
      }

      return reads[path] ?? null;
    });

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'A conta mudou. Nenhuma pré-verificação foi concluída.',
    );
  });

  it('recusa contexto ja identificado como incompleto', async () => {
    contextError.set('Vínculos parcialmente carregados.');

    await expectAsync(preflight.preview()).toBeRejectedWithError(
      'Os vínculos não foram carregados por completo. Tente novamente.',
    );
    expect(getFromServer).not.toHaveBeenCalled();
  });
});
