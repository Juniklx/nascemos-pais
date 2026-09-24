import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

import { FirestoreGateway } from '../firebase/firestore.gateway';
import type { BabyAccessRemovedNotification } from '../models/user-notification';
import { AuthService } from './auth';
import { UserNotificationRepository } from './user-notification.repository';

describe('UserNotificationRepository', () => {
  let repository: UserNotificationRepository;

  const user = signal<User | null>({
    uid: 'user-b',
  } as User);

  const waitUntilReady = jasmine.createSpy('waitUntilReady');

  const firestore = {
    get: jasmine.createSpy('get'),
    list: jasmine.createSpy('list'),
    batchWrite: jasmine.createSpy('batchWrite'),
  };

  const notification: BabyAccessRemovedNotification = {
    id: 'baby-access-removed-baby-1',
    type: 'baby-access-removed',
    babyId: 'baby-1',
    babyName: 'Helena',
    createdAt: 1000,
    readAt: null,
  };

  beforeEach(() => {
    user.set({
      uid: 'user-b',
    } as User);

    waitUntilReady.calls.reset();
    firestore.get.calls.reset();
    firestore.list.calls.reset();
    firestore.batchWrite.calls.reset();

    waitUntilReady.and.resolveTo();

    firestore.get.and.resolveTo({
      activeBabyId: 'baby-1',
    });

    firestore.list.and.resolveTo([]);

    firestore.batchWrite.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        UserNotificationRepository,
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
            waitUntilReady,
          },
        },
        {
          provide: FirestoreGateway,
          useValue: firestore,
        },
      ],
    });

    repository = TestBed.inject(UserNotificationRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('retorna a notificação não lida mais recente', async () => {
    firestore.list.and.resolveTo([
      {
        id: 'baby-access-removed-baby-1',
        type: 'baby-access-removed',
        babyId: 'baby-1',
        babyName: 'Helena',
        createdAt: Timestamp.fromMillis(1000),
        readAt: null,
      },
      {
        id: 'baby-access-removed-baby-2',
        type: 'baby-access-removed',
        babyId: 'baby-2',
        babyName: 'Theo',
        createdAt: Timestamp.fromMillis(3000),
        readAt: null,
      },
      {
        id: 'baby-access-removed-baby-3',
        type: 'baby-access-removed',
        babyId: 'baby-3',
        babyName: 'Lia',
        createdAt: Timestamp.fromMillis(4000),
        readAt: Timestamp.fromMillis(5000),
      },
    ]);

    const result = await repository.unreadAccessRemoved();

    expect(result?.id).toBe('baby-access-removed-baby-2');
    expect(result?.babyName).toBe('Theo');
    expect(waitUntilReady).toHaveBeenCalled();
    expect(firestore.list).toHaveBeenCalledOnceWith('users/user-b/notifications');
  });

  it('aguarda a autenticação antes de buscar notificações', async () => {
    user.set(null);

    waitUntilReady.and.callFake(async () => {
      user.set({
        uid: 'user-b',
      } as User);
    });

    await repository.unreadAccessRemoved();

    expect(waitUntilReady).toHaveBeenCalled();
    expect(firestore.list).toHaveBeenCalledOnceWith('users/user-b/notifications');
  });

  it('marca notificação como lida e limpa o bebê removido ainda ativo', async () => {
    await repository.acknowledgeAccessRemoved(notification);

    expect(waitUntilReady).toHaveBeenCalled();
    expect(firestore.get).toHaveBeenCalledOnceWith('users/user-b');

    const operations = firestore.batchWrite.calls.mostRecent().args[0];

    expect(operations.length).toBe(2);

    expect(operations[0]).toEqual({
      type: 'set',
      path: 'users/user-b/notifications/baby-access-removed-baby-1',
      data: {
        readAt: jasmine.anything(),
      },
      merge: true,
    });

    expect(operations[1].type).toBe('set');
    expect(operations[1].path).toBe('users/user-b');
    expect(operations[1].merge).toBeTrue();
    expect(operations[1].data['babyName']).toBe('');
    expect(operations[1].data['babyBirthDate']).toBe('');
    expect(operations[1].data['activeBabyId']).toEqual(jasmine.anything());
    expect(operations[1].data['babyMigrationVersion']).toEqual(jasmine.anything());
    expect(operations[1].data['babyMigratedAt']).toEqual(jasmine.anything());
  });

  it('seleciona outro bebê quando o acesso removido era o ativo', async () => {
    firestore.list.and.resolveTo([
      {
        id: 'baby-2',
        role: 'owner',
        joinedAt: '2026-02-01T00:00:00.000Z',
      },
    ]);

    await repository.acknowledgeAccessRemoved(notification);

    expect(firestore.list).toHaveBeenCalledOnceWith('users/user-b/babies');

    const operations = firestore.batchWrite.calls.mostRecent().args[0];

    expect(operations.length).toBe(2);
    expect(operations[1]).toEqual({
      type: 'set',
      path: 'users/user-b',
      data: {
        activeBabyId: 'baby-2',
      },
      merge: true,
    });
  });

  it('não limpa outro bebê que tenha se tornado ativo', async () => {
    firestore.get.and.resolveTo({
      activeBabyId: 'baby-2',
    });

    await repository.acknowledgeAccessRemoved(notification);

    const operations = firestore.batchWrite.calls.mostRecent().args[0];

    expect(operations.length).toBe(1);

    expect(operations[0]).toEqual({
      type: 'set',
      path: 'users/user-b/notifications/baby-access-removed-baby-1',
      data: {
        readAt: jasmine.anything(),
      },
      merge: true,
    });
  });

  it('não permite operação sem usuário autenticado', async () => {
    user.set(null);

    await expectAsync(repository.unreadAccessRemoved()).toBeRejectedWithError(
      'Usuário não autenticado.',
    );

    expect(waitUntilReady).toHaveBeenCalled();
    expect(firestore.list).not.toHaveBeenCalled();
  });
});
