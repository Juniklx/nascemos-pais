import {
  signal,
} from '@angular/core';

import {
  TestBed,
} from '@angular/core/testing';

import type {
  User,
} from 'firebase/auth';

import {
  AuthService,
} from './auth';

import {
  BabyContextService,
} from './baby-context';

import {
  BabyDataRepository,
} from './baby-data.repository';

import {
  BabyMigrationService,
} from './baby-migration';

describe(
  'BabyContextService',
  () => {
    let service:
      BabyContextService;

    const user =
      signal<User | null>(
        {
          uid:
            'user-a',
        } as User,
      );

    const auth = {
      user:
        user.asReadonly(),

      waitUntilReady:
        jasmine.createSpy(
          'waitUntilReady',
        ),
    };

    const migration = {
      ensureMigrated:
        jasmine.createSpy(
          'ensureMigrated',
        ),
    };

    const babies = {
      readBaby:
        jasmine.createSpy(
          'readBaby',
        ),

      readMembership:
        jasmine.createSpy(
          'readMembership',
        ),
    };

    const babyA = {
      id:
        'baby-a',

      name:
        'Helena',

      birthDate:
        '2026-01-01',

      createdByUid:
        'user-a',

      createdAt:
        '2026-01-01T00:00:00.000Z',

      updatedAt:
        '2026-01-01T00:00:00.000Z',
    };

    const ownerA = {
      uid:
        'user-a',

      role:
        'owner' as const,

      joinedAt:
        '2026-01-01T00:00:00.000Z',
    };

    beforeEach(() => {
      user.set(
        {
          uid:
            'user-a',
        } as User,
      );

      auth
        .waitUntilReady
        .calls.reset();

      migration
        .ensureMigrated
        .calls.reset();

      babies
        .readBaby
        .calls.reset();

      babies
        .readMembership
        .calls.reset();

      auth
        .waitUntilReady
        .and.resolveTo();

      migration
        .ensureMigrated
        .and.resolveTo(
          'baby-a',
        );

      babies
        .readBaby
        .and.resolveTo(
          babyA,
        );

      babies
        .readMembership
        .and.resolveTo(
          ownerA,
        );

      TestBed
        .configureTestingModule({
          providers: [
            BabyContextService,

            {
              provide:
                AuthService,

              useValue:
                auth,
            },

            {
              provide:
                BabyDataRepository,

              useValue:
                babies,
            },

            {
              provide:
                BabyMigrationService,

              useValue:
                migration,
            },
          ],
        });

      service =
        TestBed.inject(
          BabyContextService,
        );
    });

    it(
      'carrega bebê ativo e vínculo do usuário',
      async () => {
        await service
          .ensureLoaded();

        expect(
          service
            .activeBabyId(),
        ).toBe(
          'baby-a',
        );

        expect(
          service
            .baby()?.name,
        ).toBe(
          'Helena',
        );

        expect(
          service
            .membership()?.uid,
        ).toBe(
          'user-a',
        );

        expect(
          service.isReady(),
        ).toBeTrue();
      },
    );

    it(
      'identifica proprietário do bebê',
      async () => {
        await service
          .ensureLoaded();

        expect(
          service.isOwner(),
        ).toBeTrue();
      },
    );

    it(
      'não carrega novamente quando contexto já está pronto',
      async () => {
        await service
          .ensureLoaded();

        await service
          .ensureLoaded();

        expect(
          migration
            .ensureMigrated,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          babies
            .readBaby,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'não expõe bebê da sessão anterior',
      async () => {
        await service
          .ensureLoaded();

        expect(
          service
            .activeBabyId(),
        ).toBe(
          'baby-a',
        );

        user.set(
          {
            uid:
              'user-b',
          } as User,
        );

        expect(
          service
            .activeBabyId(),
        ).toBeNull();

        expect(
          service.baby(),
        ).toBeNull();

        expect(
          service
            .membership(),
        ).toBeNull();
      },
    );

    it(
      'não aplica resultado se a sessão mudar durante o carregamento',
      async () => {
        babies
          .readBaby
          .and.callFake(
            async () => {
              user.set(
                {
                  uid:
                    'user-b',
                } as User,
              );

              return babyA;
            },
          );

        await expectAsync(
          service
            .ensureLoaded(),
        ).toBeRejectedWithError(
          'A sessão mudou durante o carregamento do bebê.',
        );

        expect(
          service.baby(),
        ).toBeNull();

        expect(
          service
            .activeBabyId(),
        ).toBeNull();
      },
    );
  },
);