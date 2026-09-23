import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { User } from 'firebase/auth';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';
import { BabyDataRepository } from './baby-data.repository';

describe('BabyDataRepository', () => {
  let repository: BabyDataRepository;

  const user = signal<User | null>({
    uid: 'user-a',
  } as User);

  const transactionContext = {
    get: jasmine.createSpy('transactionGet'),
    set: jasmine.createSpy('transactionSet'),
    delete: jasmine.createSpy('transactionDelete'),
  };

  const firestore = {
    createId: jasmine.createSpy('createId'),
    get: jasmine.createSpy('get'),
    list: jasmine.createSpy('list'),
    set: jasmine.createSpy('set'),
    delete: jasmine.createSpy('delete'),
    batchSet: jasmine.createSpy('batchSet'),
    batchWrite: jasmine.createSpy('batchWrite'),
    transaction: jasmine.createSpy('transaction'),
  };

  beforeEach(() => {
    user.set({
      uid: 'user-a',
    } as User);

    firestore.createId.calls.reset();
    firestore.get.calls.reset();
    firestore.list.calls.reset();
    firestore.set.calls.reset();
    firestore.delete.calls.reset();
    firestore.batchSet.calls.reset();
    firestore.batchWrite.calls.reset();
    firestore.transaction.calls.reset();

    transactionContext.get.calls.reset();
    transactionContext.set.calls.reset();
    transactionContext.delete.calls.reset();

    firestore.createId.and.returnValue('baby-1');
    firestore.get.and.resolveTo(null);
    firestore.list.and.resolveTo([]);
    firestore.set.and.resolveTo();
    firestore.delete.and.resolveTo();
    firestore.batchSet.and.resolveTo();
    firestore.batchWrite.and.resolveTo();

    transactionContext.get.and.resolveTo(null);

    firestore.transaction.and.callFake(
      async (
        work: (context: typeof transactionContext) => Promise<unknown>,
      ) => work(transactionContext),
    );

    TestBed.configureTestingModule({
      providers: [
        BabyDataRepository,
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
          },
        },
        {
          provide: FirestoreGateway,
          useValue: firestore,
        },
      ],
    });

    repository = TestBed.inject(BabyDataRepository);
  });

  it('cria bebê e proprietário no mesmo lote', async () => {
    const baby = await repository.createOwnedBaby({
      name: 'Helena',
      birthDate: '2026-01-01',
    });

    expect(firestore.createId).toHaveBeenCalledOnceWith('babies');
    expect(baby.id).toBe('baby-1');
    expect(baby.createdByUid).toBe('user-a');

    const entries = firestore.batchSet.calls.mostRecent().args[0];

    expect(entries.length).toBe(3);
    expect(entries[0].path).toBe('babies/baby-1');

    expect(entries[0].data).toEqual(
      jasmine.objectContaining({
        name: 'Helena',
        birthDate: '2026-01-01',
        createdByUid: 'user-a',
      }),
    );

    expect(entries[1].path).toBe('babies/baby-1/members/user-a');

    expect(entries[1].data).toEqual(
      jasmine.objectContaining({
        role: 'owner',
      }),
    );

    expect(entries[2].path).toBe('users/user-a');

    expect(entries[2].data).toEqual({
      activeBabyId: 'baby-1',
    });
  });

  it('lê bebê pelo identificador', async () => {
    firestore.get.and.resolveTo({
      name: 'Helena',
      birthDate: '2026-01-01',
      createdByUid: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const baby = await repository.readBaby('baby-1');

    expect(firestore.get).toHaveBeenCalledOnceWith('babies/baby-1');
    expect(baby?.id).toBe('baby-1');
  });

  it('atualiza nome e nascimento do bebê', async () => {
    await repository.updateBaby('baby-1', {
      name: 'Lia',
      birthDate: '2026-02-01',
    });

    expect(firestore.set).toHaveBeenCalledOnceWith(
      'babies/baby-1',
      {
        name: 'Lia',
        birthDate: '2026-02-01',
        updatedAt: jasmine.any(String),
      },
      true,
    );
  });

  it('não atualiza bebê com dados inválidos', async () => {
    await expectAsync(
      repository.updateBaby('baby-1', {
        name: '   ',
        birthDate: '2026-02-01',
      }),
    ).toBeRejectedWithError('Dados do bebê inválidos.');

    expect(firestore.set).not.toHaveBeenCalled();
  });

  it('lê vínculo do usuário atual', async () => {
    firestore.get.and.resolveTo({
      role: 'caregiver',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    const member = await repository.readMembership('baby-1');

    expect(firestore.get).toHaveBeenCalledOnceWith(
      'babies/baby-1/members/user-a',
    );
    expect(member?.role).toBe('caregiver');
  });

  it('preserva convite e nome no vínculo do responsável', async () => {
    const inviteId = 'a'.repeat(64);

    firestore.get.and.resolveTo({
      role: 'caregiver',
      joinedAt: '2026-01-01T00:00:00.000Z',
      inviteId,
      caregiverName: 'Ana',
    });

    const member = await repository.readMembership('baby-1');

    expect(member?.role).toBe('caregiver');
    expect(member?.inviteId).toBe(inviteId);
    expect(member?.caregiverName).toBe('Ana');
  });

  it('lista registros dentro do bebê', async () => {
    await repository.listRecords('baby-1', 'feedings');

    expect(firestore.list).toHaveBeenCalledOnceWith(
      'babies/baby-1/feedings',
    );
  });

  it('salva mamada finalizada em transação', async () => {
    const record = {
      id: 'feeding-1',
      startedAt: 1000,
      endedAt: 2000,
      side: 'left',
      periods: null,
    };

    await repository.saveRecord('baby-1', 'feedings', record);

    expect(firestore.transaction).toHaveBeenCalledTimes(1);

    expect(transactionContext.get).toHaveBeenCalledOnceWith(
      'babies/baby-1/activeActivities/feeding',
    );

    expect(transactionContext.set).toHaveBeenCalledOnceWith(
      'babies/baby-1/feedings/feeding-1',
      record,
      true,
    );

    expect(transactionContext.delete).not.toHaveBeenCalled();
  });

  it('cria lock ao iniciar mamada', async () => {
    const record = {
      id: 'feeding-1',
      startedAt: 1000,
      endedAt: null,
      side: 'left',
      periods: null,
    };

    await repository.saveRecord('baby-1', 'feedings', record);

    expect(transactionContext.set).toHaveBeenCalledWith(
      'babies/baby-1/feedings/feeding-1',
      record,
      true,
    );

    expect(transactionContext.set).toHaveBeenCalledWith(
      'babies/baby-1/activeActivities/feeding',
      {
        recordId: 'feeding-1',
      },
      false,
    );
  });

  it('nega segunda mamada enquanto outra está em andamento', async () => {
    transactionContext.get.and.resolveTo({
      recordId: 'feeding-1',
    });

    const record = {
      id: 'feeding-2',
      startedAt: 2000,
      endedAt: null,
      side: 'right',
      periods: null,
    };

    await expectAsync(
      repository.saveRecord('baby-1', 'feedings', record),
    ).toBeRejectedWithError('Já existe uma mamada em andamento.');

    expect(transactionContext.set).not.toHaveBeenCalled();
  });

  it('remove lock ao encerrar a mamada ativa', async () => {
    transactionContext.get.and.resolveTo({
      recordId: 'feeding-1',
    });

    const record = {
      id: 'feeding-1',
      startedAt: 1000,
      endedAt: 2000,
      side: 'left',
      periods: null,
    };

    await repository.saveRecord('baby-1', 'feedings', record);

    expect(transactionContext.set).toHaveBeenCalledWith(
      'babies/baby-1/feedings/feeding-1',
      record,
      true,
    );

    expect(transactionContext.delete).toHaveBeenCalledOnceWith(
      'babies/baby-1/activeActivities/feeding',
    );
  });

  it('nega segundo sono enquanto outro está em andamento', async () => {
    transactionContext.get.and.resolveTo({
      recordId: 'sleep-1',
    });

    const record = {
      id: 'sleep-2',
      startedAt: 2000,
      endedAt: null,
    };

    await expectAsync(
      repository.saveRecord('baby-1', 'sleeps', record),
    ).toBeRejectedWithError('Já existe um sono em andamento.');

    expect(transactionContext.set).not.toHaveBeenCalled();
  });

  it('salva fralda sem utilizar transação', async () => {
    const record = {
      id: 'diaper-1',
      type: 'wet',
      recordedAt: 1000,
    };

    await repository.saveRecord('baby-1', 'diapers', record);

    expect(firestore.set).toHaveBeenCalledOnceWith(
      'babies/baby-1/diapers/diaper-1',
      record,
      true,
    );

    expect(firestore.transaction).not.toHaveBeenCalled();
  });

  it('impede operação sem autenticação', async () => {
    user.set(null);

    await expectAsync(
      repository.readBaby('baby-1'),
    ).toBeRejectedWithError('Usuário não autenticado.');

    expect(firestore.get).not.toHaveBeenCalled();
  });

  it('detecta troca de sessão durante gravação', async () => {
    const record = {
      id: 'diaper-1',
      type: 'wet',
      recordedAt: 1000,
    };

    firestore.set.and.callFake(async () => {
      user.set({
        uid: 'user-b',
      } as User);
    });

    await expectAsync(
      repository.saveRecord('baby-1', 'diapers', record),
    ).toBeRejectedWithError('A sessão mudou durante a operação.');

    expect(firestore.set).toHaveBeenCalledOnceWith(
      'babies/baby-1/diapers/diaper-1',
      record,
      true,
    );
  });

  it('remove responsável e cria notificação no mesmo lote', async () => {
    firestore.get.and.resolveTo({
      name: 'Helena',
      birthDate: '2026-01-01',
      createdByUid: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await repository.removeMember('baby-1', 'user-b');

    expect(firestore.get).toHaveBeenCalledOnceWith('babies/baby-1');

    const operations = firestore.batchWrite.calls.mostRecent().args[0];

    expect(operations.length).toBe(2);

    expect(operations[0]).toEqual({
      type: 'set',
      path: 'users/user-b/notifications/baby-access-removed-baby-1',
      data: jasmine.objectContaining({
        type: 'baby-access-removed',
        babyId: 'baby-1',
        babyName: 'Helena',
        createdAt: jasmine.anything(),
        readAt: null,
      }),
      merge: false,
    });

    expect(operations[1]).toEqual({
      type: 'delete',
      path: 'babies/baby-1/members/user-b',
    });
  });

  it('não remove o próprio vínculo por esta ação', async () => {
    await expectAsync(
      repository.removeMember('baby-1', 'user-a'),
    ).toBeRejectedWithError(
      'Não é possível remover o próprio vínculo por esta ação.',
    );

    expect(firestore.batchWrite).not.toHaveBeenCalled();
  });

  it('não remove responsável quando o bebê não é encontrado', async () => {
    firestore.get.and.resolveTo(null);

    await expectAsync(
      repository.removeMember('baby-1', 'user-b'),
    ).toBeRejectedWithError('Bebê não encontrado.');

    expect(firestore.batchWrite).not.toHaveBeenCalled();
  });

  it('atualiza nome do responsável no perfil e no vínculo', async () => {
    await repository.updateOwnCaregiverName('baby-1', 'Ana');

    expect(firestore.batchSet).toHaveBeenCalledOnceWith([
      {
        path: 'babies/baby-1/members/user-a',
        data: {
          caregiverName: 'Ana',
        },
      },
      {
        path: 'users/user-a',
        data: {
          caregiverName: 'Ana',
        },
      },
    ]);
  });

  it('não atualiza nome inválido do responsável', async () => {
    await expectAsync(
      repository.updateOwnCaregiverName('baby-1', '   '),
    ).toBeRejectedWithError('Nome do responsável inválido.');

    expect(firestore.batchSet).not.toHaveBeenCalled();
  });
});