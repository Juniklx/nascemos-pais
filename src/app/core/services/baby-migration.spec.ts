import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { User } from 'firebase/auth';
import { AuthService } from './auth';
import { BabyDataRepository } from './baby-data.repository';
import { BabyMigrationService } from './baby-migration';
import { UserDataRepository } from './user-data.repository';

describe('BabyMigrationService', () => {
  let service: BabyMigrationService;

  const user = signal<User | null>({
    uid: 'user-a',
  } as User);

  const feeding = {
    id: 'feeding-1',
    startedAt: 1000,
    endedAt: 2000,
    side: null,
    periods: null,
  };

  const sleep = {
    id: 'sleep-1',
    startedAt: 3000,
    endedAt: 4000,
  };

  const diaper = {
    id: 'diaper-1',
    type: 'wet',
    recordedAt: 5000,
  };

  const baseProfile = {
    caregiverName: 'Marcelo',
    babyName: 'Helena',
    babyBirthDate: '2026-01-01',
    consentGiven: true,
    consentAt: '2026-01-01T00:00:00.000Z',
  };

  const baby = {
    id: 'baby-1',
    name: 'Helena',
    birthDate: '2026-01-01',
    createdByUid: 'user-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const auth = {
    user: user.asReadonly(),
    waitUntilReady: jasmine.createSpy('waitUntilReady'),
  };

  const users = {
    readProfile: jasmine.createSpy('readProfile'),
    listRecords: jasmine.createSpy('listRecords'),
    saveProfile: jasmine.createSpy('saveProfile'),
  };

  const babies = {
    createOwnedBaby: jasmine.createSpy('createOwnedBaby'),
    claimOwnedBaby: jasmine.createSpy('claimOwnedBaby'),
    readBaby: jasmine.createSpy('readBaby'),
    readMembership: jasmine.createSpy('readMembership'),
    saveRecords: jasmine.createSpy('saveRecords'),
    listRecords: jasmine.createSpy('listRecords'),
  };

  beforeEach(() => {
    user.set({
      uid: 'user-a',
    } as User);

    auth.waitUntilReady.calls.reset();

    users.readProfile.calls.reset();
    users.listRecords.calls.reset();
    users.saveProfile.calls.reset();

    babies.createOwnedBaby.calls.reset();
    babies.claimOwnedBaby.calls.reset();
    babies.readBaby.calls.reset();
    babies.readMembership.calls.reset();
    babies.saveRecords.calls.reset();
    babies.listRecords.calls.reset();

    auth.waitUntilReady.and.resolveTo();

    users.readProfile.and.resolveTo(baseProfile);
    users.saveProfile.and.resolveTo();

    users.listRecords.and.callFake(async (collectionName: string) => {
      switch (collectionName) {
        case 'feedings':
          return [feeding];

        case 'sleeps':
          return [sleep];

        case 'diapers':
          return [diaper];

        default:
          return [];
      }
    });

    babies.createOwnedBaby.and.resolveTo(baby);
    babies.claimOwnedBaby.and.resolveTo(baby);
    babies.readBaby.and.resolveTo(baby);

    babies.readMembership.and.resolveTo({
      uid: 'user-a',
      role: 'owner',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    babies.saveRecords.and.resolveTo();

    babies.listRecords.and.callFake(async (_babyId: string, collectionName: string) => {
      switch (collectionName) {
        case 'feedings':
          return [feeding];

        case 'sleeps':
          return [sleep];

        case 'diapers':
          return [diaper];

        default:
          return [];
      }
    });

    TestBed.configureTestingModule({
      providers: [
        BabyMigrationService,
        {
          provide: AuthService,
          useValue: auth,
        },
        {
          provide: UserDataRepository,
          useValue: users,
        },
        {
          provide: BabyDataRepository,
          useValue: babies,
        },
      ],
    });

    service = TestBed.inject(BabyMigrationService);
  });

  it('migra bebê e registros legados', async () => {
    const result = await service.ensureMigrated();

    expect(result).toBe('baby-1');

    expect(babies.claimOwnedBaby).toHaveBeenCalledOnceWith({
      name: 'Helena',
      birthDate: '2026-01-01',
    });

    expect(babies.createOwnedBaby).not.toHaveBeenCalled();

    expect(babies.saveRecords).toHaveBeenCalledTimes(3);
    expect(users.saveProfile).toHaveBeenCalledTimes(1);

    const saved = users.saveProfile.calls.mostRecent().args[0];

    expect(saved.activeBabyId).toBe('baby-1');
    expect(saved.babyMigrationVersion).toBe(1);
    expect(typeof saved.babyMigratedAt).toBe('string');
  });

  it('usa o mesmo bebê quando outra migração venceu a disputa', async () => {
    babies.claimOwnedBaby.and.resolveTo({
      ...baby,
      id: 'baby-winner',
    });

    babies.listRecords.and.callFake(async (babyId: string, collectionName: string) => {
      expect(babyId).toBe('baby-winner');

      switch (collectionName) {
        case 'feedings':
          return [feeding];

        case 'sleeps':
          return [sleep];

        case 'diapers':
          return [diaper];

        default:
          return [];
      }
    });

    const result = await service.ensureMigrated();

    expect(result).toBe('baby-winner');

    expect(babies.saveRecords).toHaveBeenCalledWith('baby-winner', 'feedings', [feeding]);

    expect(babies.saveRecords).toHaveBeenCalledWith('baby-winner', 'sleeps', [sleep]);

    expect(babies.saveRecords).toHaveBeenCalledWith('baby-winner', 'diapers', [diaper]);

    expect(users.saveProfile).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activeBabyId: 'baby-winner',
        babyMigrationVersion: 1,
      }),
    );
  });

  it('reutiliza bebê quando uma migração anterior foi interrompida', async () => {
    users.readProfile.and.resolveTo({
      ...baseProfile,
      activeBabyId: 'baby-1',
    });

    const result = await service.ensureMigrated();

    expect(result).toBe('baby-1');

    expect(babies.claimOwnedBaby).not.toHaveBeenCalled();

    expect(babies.readBaby).toHaveBeenCalledOnceWith('baby-1');
    expect(babies.readMembership).toHaveBeenCalledOnceWith('baby-1');
  });

  it('não repete cópia quando a migração já foi concluída', async () => {
    users.readProfile.and.resolveTo({
      ...baseProfile,
      activeBabyId: 'baby-1',
      babyMigrationVersion: 1,
      babyMigratedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await service.ensureMigrated();

    expect(result).toBe('baby-1');

    expect(users.listRecords).not.toHaveBeenCalled();
    expect(babies.saveRecords).not.toHaveBeenCalled();
    expect(users.saveProfile).not.toHaveBeenCalled();
    expect(babies.claimOwnedBaby).not.toHaveBeenCalled();
  });

  it('recusa continuar migração em bebê que não pertence ao proprietário', async () => {
    users.readProfile.and.resolveTo({
      ...baseProfile,
      activeBabyId: 'baby-1',
    });

    babies.readMembership.and.resolveTo({
      uid: 'user-a',
      role: 'caregiver',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    await expectAsync(service.ensureMigrated()).toBeRejectedWithError(
      'A migração do bebê está inconsistente.',
    );

    expect(babies.saveRecords).not.toHaveBeenCalled();
  });

  it('conclui contexto de responsável convidado sem migrar registros legados', async () => {
    users.readProfile.and.resolveTo({
      caregiverName: 'Responsável',
      babyName: '',
      babyBirthDate: '',
      consentGiven: true,
      consentAt: '2026-01-01T00:00:00.000Z',
      activeBabyId: 'baby-shared',
    });

    babies.readBaby.and.resolveTo({
      id: 'baby-shared',
      name: 'Helena',
      birthDate: '2026-01-01',
      createdByUid: 'owner-user',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    babies.readMembership.and.resolveTo({
      uid: 'user-a',
      role: 'caregiver',
      joinedAt: '2026-01-02T00:00:00.000Z',
      inviteId: 'a'.repeat(64),
    });

    const babyId = await service.ensureMigrated();

    expect(babyId).toBe('baby-shared');
    expect(babies.saveRecords).not.toHaveBeenCalled();

    expect(users.saveProfile).toHaveBeenCalledWith(
      jasmine.objectContaining({
        babyName: 'Helena',
        babyBirthDate: '2026-01-01',
        babyMigrationVersion: 1,
      }),
    );
  });

  it('sincroniza dados do bebê quando responsável troca para bebê compartilhado', async () => {
    users.readProfile.and.resolveTo({
      caregiverName: 'Responsável',
      babyName: 'Bebê antigo',
      babyBirthDate: '2025-01-01',
      consentGiven: true,
      consentAt: '2026-01-01T00:00:00.000Z',
      activeBabyId: 'baby-shared',
      babyMigrationVersion: 1,
    });

    babies.readBaby.and.resolveTo({
      id: 'baby-shared',
      name: 'Helena',
      birthDate: '2026-01-01',
      createdByUid: 'owner-user',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    babies.readMembership.and.resolveTo({
      uid: 'user-a',
      role: 'caregiver',
      joinedAt: '2026-01-02T00:00:00.000Z',
      inviteId: 'a'.repeat(64),
    });

    const babyId = await service.ensureMigrated();

    expect(babyId).toBe('baby-shared');

    expect(users.saveProfile).toHaveBeenCalledWith({
      babyName: 'Helena',
      babyBirthDate: '2026-01-01',
    });

    expect(babies.saveRecords).not.toHaveBeenCalled();
  });

  it('não conclui migração se algum registro não for confirmado', async () => {
    babies.listRecords.and.callFake(async (_babyId: string, collectionName: string) => {
      if (collectionName === 'diapers') {
        return [];
      }

      if (collectionName === 'feedings') {
        return [feeding];
      }

      return [sleep];
    });

    await expectAsync(service.ensureMigrated()).toBeRejectedWithError(
      'A migração dos registros do bebê não foi confirmada.',
    );

    expect(users.saveProfile).not.toHaveBeenCalled();
  });
});
