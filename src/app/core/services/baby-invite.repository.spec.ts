import { signal } from '@angular/core';

import { TestBed } from '@angular/core/testing';

import { User } from 'firebase/auth';

import { Timestamp } from 'firebase/firestore';

import { FirestoreGateway } from '../firebase/firestore.gateway';

import { AuthService } from './auth';

import { BabyInviteRepository } from './baby-invite.repository';

describe('BabyInviteRepository', () => {
  let repository: BabyInviteRepository;

  let user: ReturnType<typeof signal<User | null>>;

  let firestore: {
    get: jasmine.Spy;

    set: jasmine.Spy;

    batchSet: jasmine.Spy;
  };

  const token = 'a'.repeat(64);

  function pendingInvite(overrides: Record<string, unknown> = {}) {
    const now = Date.now();

    return {
      babyId: 'baby-1',

      createdByUid: 'owner-user',

      createdAt: Timestamp.fromMillis(now - 1000),

      expiresAt: Timestamp.fromMillis(now + 60 * 60 * 1000),

      status: 'pending',

      ...overrides,
    };
  }

  beforeEach(() => {
    user = signal<User | null>({
      uid: 'user-a',
    } as User);

    firestore = jasmine.createSpyObj('FirestoreGateway', ['get', 'set', 'batchSet']);

    firestore.get.and.resolveTo(null);

    firestore.set.and.resolveTo();

    firestore.batchSet.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        BabyInviteRepository,

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

    repository = TestBed.inject(BabyInviteRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('cria convite seguro com duração de 24 horas', async () => {
    const before = Date.now();

    const invite = await repository.createInvite('baby-1');

    const after = Date.now();

    expect(invite.id).toMatch(/^[0-9a-f]{64}$/);

    expect(invite.babyId).toBe('baby-1');

    expect(invite.createdByUid).toBe('user-a');

    expect(invite.status).toBe('pending');

    expect(invite.acceptedByUid).toBeNull();

    expect(invite.acceptedAt).toBeNull();

    expect(invite.createdAt).toBeGreaterThanOrEqual(before);

    expect(invite.createdAt).toBeLessThanOrEqual(after);

    expect(invite.expiresAt - invite.createdAt).toBe(24 * 60 * 60 * 1000);

    const call = firestore.set.calls.mostRecent();

    expect(call.args[0]).toBe(`babyInvites/${invite.id}`);

    expect(call.args[1]).toEqual(
      jasmine.objectContaining({
        babyId: 'baby-1',

        createdByUid: 'user-a',

        status: 'pending',

        createdAt: jasmine.anything(),

        expiresAt: jasmine.any(Timestamp),
      }),
    );

    expect(call.args[2]).toBeFalse();
  });

  it('lê convite pendente', async () => {
    const now = Date.now();

    firestore.get.and.resolveTo({
      babyId: 'baby-1',

      createdByUid: 'owner-user',

      createdAt: Timestamp.fromMillis(now),

      expiresAt: Timestamp.fromMillis(now + 10000),

      status: 'pending',
    });

    const invite = await repository.readInvite(token);

    expect(firestore.get).toHaveBeenCalledOnceWith(`babyInvites/${token}`);

    expect(invite).toEqual({
      id: token,

      babyId: 'baby-1',

      createdByUid: 'owner-user',

      createdAt: now,

      expiresAt: now + 10000,

      status: 'pending',

      acceptedByUid: null,

      acceptedAt: null,
    });
  });

  it('lê convite já aceito', async () => {
    const now = Date.now();

    firestore.get.and.resolveTo({
      babyId: 'baby-1',

      createdByUid: 'owner-user',

      createdAt: Timestamp.fromMillis(now - 2000),

      expiresAt: Timestamp.fromMillis(now + 10000),

      status: 'accepted',

      acceptedByUid: 'user-a',

      acceptedAt: Timestamp.fromMillis(now - 1000),
    });

    const invite = await repository.readInvite(token);

    expect(invite?.status).toBe('accepted');

    expect(invite?.acceptedByUid).toBe('user-a');

    expect(invite?.acceptedAt).toBe(now - 1000);
  });

  it('aceita convite em um único lote', async () => {
    firestore.get.and.resolveTo(pendingInvite());

    const babyId = await repository.acceptInvite(token);

    expect(babyId).toBe('baby-1');

    const entries = firestore.batchSet.calls.mostRecent().args[0];

    expect(entries.length).toBe(3);

    expect(entries[0].path).toBe(`babyInvites/${token}`);

    expect(entries[0].data).toEqual(
      jasmine.objectContaining({
        status: 'accepted',

        acceptedByUid: 'user-a',

        acceptedAt: jasmine.anything(),
      }),
    );

    expect(entries[1].path).toBe('babies/baby-1/members/user-a');

    expect(entries[1].data).toEqual(
      jasmine.objectContaining({
        role: 'caregiver',

        inviteId: token,

        joinedAt: jasmine.any(String),
      }),
    );

    expect(entries[2]).toEqual({
      path: 'users/user-a',

      data: {
        activeBabyId: 'baby-1',
      },
    });
  });

  it('não aceita convite expirado', async () => {
    const now = Date.now();

    firestore.get.and.resolveTo(
      pendingInvite({
        /*
         * O convite continua sendo
         * estruturalmente válido:
         *
         * createdAt < expiresAt
         *
         * porém ambos já estão no
         * passado.
         */
        createdAt: Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),

        expiresAt: Timestamp.fromMillis(now - 1000),
      }),
    );

    await expectAsync(repository.acceptInvite(token)).toBeRejectedWithError(
      'Este convite expirou.',
    );

    expect(firestore.batchSet).not.toHaveBeenCalled();
  });

  it('não aceita convite já utilizado', async () => {
    firestore.get.and.resolveTo(
      pendingInvite({
        status: 'accepted',

        acceptedByUid: 'user-b',

        acceptedAt: Timestamp.fromMillis(Date.now()),
      }),
    );

    await expectAsync(repository.acceptInvite(token)).toBeRejectedWithError(
      'Este convite já foi utilizado.',
    );

    expect(firestore.batchSet).not.toHaveBeenCalled();
  });

  it('não permite proprietário aceitar o próprio convite', async () => {
    firestore.get.and.resolveTo(
      pendingInvite({
        createdByUid: 'user-a',
      }),
    );

    await expectAsync(repository.acceptInvite(token)).toBeRejectedWithError(
      'O proprietário não pode aceitar o próprio convite.',
    );

    expect(firestore.batchSet).not.toHaveBeenCalled();
  });

  it('detecta troca de sessão durante aceitação', async () => {
    firestore.get.and.resolveTo(pendingInvite());

    firestore.batchSet.and.callFake(async () => {
      user.set({
        uid: 'user-b',
      } as User);
    });

    await expectAsync(repository.acceptInvite(token)).toBeRejectedWithError(
      'A sessão mudou durante a operação.',
    );
  });
});
