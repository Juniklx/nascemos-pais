import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { FirestoreGateway, type FirestoreTransactionContext } from '../firebase/firestore.gateway';
import { AuthService } from './auth';
import { FeedingV2TransactionRepository } from './feeding-v2-transaction';

describe('FeedingV2TransactionRepository (protótipo isolado)', () => {
  let repo: FeedingV2TransactionRepository;
  let session: ReturnType<typeof signal<User | null>>;
  let documents: Map<string, Record<string, unknown>>;
  let transaction: jasmine.Spy;

  beforeEach(() => {
    session = signal<User | null>({ uid: 'user-a' } as User);
    documents = new Map();
    transaction = jasmine.createSpy('transaction').and.callFake(
      async (work: (tx: FirestoreTransactionContext) => Promise<unknown>) => {
        const changes: (() => void)[] = [];
        const tx: FirestoreTransactionContext = {
          get: async (path) => {
            const value = documents.get(path);
            return value ? { ...value } : null;
          },
          set: (path, data, merge = true) => changes.push(() => {
            documents.set(path, { ...(merge ? documents.get(path) : {}), ...data });
          }),
          delete: (path) => changes.push(() => documents.delete(path)),
        };

        const result = await work(tx);

        for (const change of changes) {
          change();
        }

        return result;
      },
    );
    TestBed.configureTestingModule({
      providers: [
        FeedingV2TransactionRepository,
        { provide: AuthService, useValue: { user: session.asReadonly() } },
        { provide: FirestoreGateway, useValue: { transaction } },
      ],
    });
    repo = TestBed.inject(FeedingV2TransactionRepository);
  });

  afterEach(() => TestBed.resetTestingModule());

  const root = 'babies/baby-a/feedings/feeding-a';
  const first = `${root}/periods/00000000`;
  const second = `${root}/periods/00000001`;
  const lock = 'babies/baby-a/activeActivities/feeding';

  it('inicia a mamada, troca de lado e fecha último período e lock', async () => {
    await repo.start('baby-a', 'feeding-a', 1000);
    expect(documents.get(root)?.['storageVersion']).toBe(2);
    expect(documents.get(first)?.['endedAt']).toBeNull();
    expect(documents.get(lock)?.['recordId']).toBe('feeding-a');

    expect(await repo.switchSide('baby-a', 'feeding-a', 'left', 1100)).toBeTrue();
    expect(documents.get(first)?.['endedAt']).toBe(1100);
    expect(documents.get(second)?.['startedAt']).toBe(1100);
    expect(documents.get(root)?.['periodCount']).toBe(2);

    await repo.finish('baby-a', 'feeding-a', 1200);
    expect(documents.get(second)?.['endedAt']).toBe(1200);
    expect(documents.get(root)?.['finishedByUid']).toBe('user-a');
    expect(documents.has(lock)).toBeFalse();
  });

  it('não cria período se o lado selecionado já for o atual', async () => {
    await repo.start('baby-a', 'feeding-a', 1000);
    expect(await repo.switchSide('baby-a', 'feeding-a', null, 1100)).toBeFalse();
    expect(documents.get(root)?.['periodCount']).toBe(1);
  });

  it('interrompe nova mamada se existe um lock', async () => {
    documents.set(lock, { recordId: 'outro-registro' });
    await expectAsync(repo.start('baby-a', 'feeding-a', 1000)).toBeRejected();
    expect(documents.has(root)).toBeFalse();
  });

  it('impede alteração quando falta o último período', async () => {
    await repo.start('baby-a', 'feeding-a', 1000);
    documents.delete(first);
    await expectAsync(repo.switchSide('baby-a', 'feeding-a', 'left', 1100)).toBeRejected();
    expect(documents.has(second)).toBeFalse();
  });

  it('interrompe operação quando a conta é alterada durante uma leitura', async () => {
    await repo.start('baby-a', 'feeding-a', 1000);
    transaction.and.callFake(async (work: (tx: FirestoreTransactionContext) => Promise<unknown>) => {
      const tx: FirestoreTransactionContext = {
        get: async (path) => {
          session.set({ uid: 'user-b' } as User);
          return documents.get(path) ?? null;
        },
        set: jasmine.createSpy('set'),
        delete: jasmine.createSpy('delete'),
      };
      return work(tx);
    });

    await expectAsync(repo.finish('baby-a', 'feeding-a', 1200)).toBeRejectedWithError(
      'A sessão mudou. Atualize os registros antes de continuar.',
    );
  });
});
