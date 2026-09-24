import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';
import { BabyDataRepository } from './baby-data.repository';
import { BabyMigrationService } from './baby-migration';

describe('BabyContextService', () => {
  let service: BabyContextService;

  const user = signal<User | null>({
    uid: 'user-a',
  } as User);

  const auth = {
    user: user.asReadonly(),
    waitUntilReady: jasmine.createSpy('waitUntilReady'),
  };

  const migration = {
    ensureMigrated: jasmine.createSpy('ensureMigrated'),
  };

  const babies = {
    readBaby: jasmine.createSpy('readBaby'),
    readMembership: jasmine.createSpy('readMembership'),
    ensureBabyReference: jasmine.createSpy('ensureBabyReference'),
    listLinkedBabies: jasmine.createSpy('listLinkedBabies'),
    setActiveBaby: jasmine.createSpy('setActiveBaby'),
  };

  const babyA = {
    id: 'baby-a',
    name: 'Helena',
    birthDate: '2026-01-01',
    createdByUid: 'user-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const babyB = {
    id: 'baby-b',
    name: 'Lucas',
    birthDate: '2026-02-01',
    createdByUid: 'user-b',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };

  const ownerA = {
    uid: 'user-a',
    role: 'owner' as const,
    joinedAt: '2026-01-01T00:00:00.000Z',
  };

  const caregiverB = {
    uid: 'user-a',
    role: 'caregiver' as const,
    joinedAt: '2026-02-02T00:00:00.000Z',
    inviteId: 'a'.repeat(64),
  };

  beforeEach(() => {
    user.set({
      uid: 'user-a',
    } as User);

    for (const spy of Object.values(babies)) {
      spy.calls.reset();
    }

    auth.waitUntilReady.calls.reset();
    migration.ensureMigrated.calls.reset();

    auth.waitUntilReady.and.resolveTo();
    migration.ensureMigrated.and.resolveTo('baby-a');
    babies.readBaby.and.resolveTo(babyA);
    babies.readMembership.and.resolveTo(ownerA);
    babies.ensureBabyReference.and.resolveTo();
    babies.listLinkedBabies.and.resolveTo([
      {
        baby: babyA,
        membership: ownerA,
      },
      {
        baby: babyB,
        membership: caregiverB,
      },
    ]);
    babies.setActiveBaby.and.resolveTo({
      baby: babyB,
      membership: caregiverB,
    });

    TestBed.configureTestingModule({
      providers: [
        BabyContextService,
        {
          provide: AuthService,
          useValue: auth,
        },
        {
          provide: BabyDataRepository,
          useValue: babies,
        },
        {
          provide: BabyMigrationService,
          useValue: migration,
        },
      ],
    });

    service = TestBed.inject(BabyContextService);
  });

  it('carrega bebê ativo e todos os vínculos do usuário', async () => {
    await service.ensureLoaded();

    expect(service.activeBabyId()).toBe('baby-a');
    expect(service.baby()?.name).toBe('Helena');
    expect(service.membership()?.uid).toBe('user-a');
    expect(service.linkedBabies().map((item) => item.baby.id)).toEqual(['baby-a', 'baby-b']);
    expect(service.isReady()).toBeTrue();
    expect(babies.ensureBabyReference).toHaveBeenCalledOnceWith('baby-a', ownerA);
    expect(babies.listLinkedBabies).toHaveBeenCalledTimes(1);
  });

  it('identifica proprietário do bebê ativo', async () => {
    await service.ensureLoaded();

    expect(service.isOwner()).toBeTrue();
  });

  it('troca o bebê ativo e atualiza o vínculo selecionado', async () => {
    await service.ensureLoaded();
    await service.selectBaby('baby-b');

    expect(babies.setActiveBaby).toHaveBeenCalledOnceWith('baby-b');
    expect(service.activeBabyId()).toBe('baby-b');
    expect(service.baby()?.name).toBe('Lucas');
    expect(service.membership()?.role).toBe('caregiver');
    expect(service.isOwner()).toBeFalse();
    expect(service.linkedBabies().map((item) => item.baby.id)).toEqual(['baby-a', 'baby-b']);
  });

  it('não grava novamente quando o bebê solicitado já está ativo', async () => {
    await service.ensureLoaded();
    await service.selectBaby('baby-a');

    expect(babies.setActiveBaby).not.toHaveBeenCalled();
  });

  it('não carrega novamente quando contexto já está pronto', async () => {
    await service.ensureLoaded();
    await service.ensureLoaded();

    expect(migration.ensureMigrated).toHaveBeenCalledTimes(1);
    expect(babies.readBaby).toHaveBeenCalledTimes(1);
  });

  it('não expõe bebê da sessão anterior', async () => {
    await service.ensureLoaded();

    user.set({
      uid: 'user-b',
    } as User);

    expect(service.activeBabyId()).toBeNull();
    expect(service.baby()).toBeNull();
    expect(service.membership()).toBeNull();
    expect(service.linkedBabies()).toEqual([]);
  });

  it('não aplica resultado se a sessão mudar durante o carregamento', async () => {
    babies.readBaby.and.callFake(async () => {
      user.set({
        uid: 'user-b',
      } as User);

      return babyA;
    });

    await expectAsync(service.ensureLoaded()).toBeRejectedWithError(
      'A sessão mudou durante o carregamento do bebê.',
    );

    expect(service.baby()).toBeNull();
    expect(service.activeBabyId()).toBeNull();
  });
});
