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
  ActivityPersistenceService,
} from './activity-persistence';

import {
  AuthService,
} from './auth';

import {
  UserDataRepository,
} from './user-data.repository';

describe(
  'ActivityPersistenceService',
  () => {
    const feedingKey =
      'nascemos-pais:feedings:v2';

    const legacyFeedingKey =
      'nascemos-pais:feedings:v1';

    const sleepKey =
      'nascemos-pais:sleeps:v1';

    const diaperKey =
      'nascemos-pais:diapers:v1';

    let service:
      ActivityPersistenceService;

    let user:
      ReturnType<
        typeof signal<User | null>
      >;

    let repository: {
      readProfile: jasmine.Spy;
      listRecords: jasmine.Spy;
      saveRecords: jasmine.Spy;
      saveProfile: jasmine.Spy;
      saveRecord: jasmine.Spy;
      deleteRecord: jasmine.Spy;
    };

    const feeding = {
      id: 'feeding-1',
      startedAt: 1000,
      endedAt: null,
      side: 'left' as const,

      periods: [
        {
          startedAt: 1000,
          endedAt: null,
          side: 'left' as const,
        },
      ],
    };

    const sleep = {
      id: 'sleep-1',
      startedAt: 2000,
      endedAt: 3000,
    };

    const diaper = {
      id: 'diaper-1',
      type: 'wet' as const,
      recordedAt: 4000,
    };

    beforeEach(() => {
      localStorage.clear();

      user =
        signal<User | null>(
          {
            uid: 'user-a',
          } as User,
        );

      repository =
        jasmine.createSpyObj(
          'UserDataRepository',
          [
            'readProfile',
            'listRecords',
            'saveRecords',
            'saveProfile',
            'saveRecord',
            'deleteRecord',
          ],
        );

      repository
        .readProfile
        .and.resolveTo({});

      repository
        .listRecords
        .and.resolveTo([]);

      repository
        .saveRecords
        .and.resolveTo();

      repository
        .saveProfile
        .and.resolveTo();

      TestBed.configureTestingModule({
        providers: [
          ActivityPersistenceService,

          {
            provide:
              AuthService,

            useValue: {
              user:
                user.asReadonly(),

              waitUntilReady:
                jasmine
                  .createSpy(
                    'waitUntilReady',
                  )
                  .and.resolveTo(),
            },
          },

          {
            provide:
              UserDataRepository,

            useValue:
              repository,
          },
        ],
      });

      service =
        TestBed.inject(
          ActivityPersistenceService,
        );
    });

    afterEach(() => {
      localStorage.clear();

      TestBed
        .resetTestingModule();
    });

    it(
      'migra registros locais preservando os IDs e registros ativos',
      async () => {
        localStorage.setItem(
          feedingKey,
          JSON.stringify([
            feeding,
          ]),
        );

        localStorage.setItem(
          sleepKey,
          JSON.stringify([
            sleep,
          ]),
        );

        localStorage.setItem(
          diaperKey,
          JSON.stringify([
            diaper,
          ]),
        );

        const result =
          await service.load();

        expect(
          result.feedings,
        ).toEqual([
          feeding,
        ]);

        expect(
          result.feedings[0]
            .endedAt,
        ).toBeNull();

        expect(
          repository.saveRecords,
        ).toHaveBeenCalledWith(
          'feedings',
          [feeding],
        );

        expect(
          repository.saveRecords,
        ).toHaveBeenCalledWith(
          'sleeps',
          [sleep],
        );

        expect(
          repository.saveRecords,
        ).toHaveBeenCalledWith(
          'diapers',
          [diaper],
        );

        expect(
          repository.saveProfile,
        ).toHaveBeenCalledWith(
          jasmine.objectContaining({
            recordsMigrationVersion:
              1,
          }),
        );

        expect(
          localStorage.getItem(
            feedingKey,
          ),
        ).toBeNull();

        expect(
          localStorage.getItem(
            sleepKey,
          ),
        ).toBeNull();

        expect(
          localStorage.getItem(
            diaperKey,
          ),
        ).toBeNull();
      },
    );

    it(
      'não remigra dados locais depois que a migração foi concluída',
      async () => {
        repository
          .readProfile
          .and.resolveTo({
            recordsMigrationVersion:
              1,
          });

        repository
          .listRecords
          .and.callFake(
            async (
              collection,
            ) => {
              switch (
              collection
              ) {
                case 'feedings':
                  return [
                    feeding,
                  ];

                case 'sleeps':
                  return [
                    sleep,
                  ];

                case 'diapers':
                  return [
                    diaper,
                  ];

                default:
                  return [];
              }
            },
          );

        localStorage.setItem(
          feedingKey,
          JSON.stringify([
            {
              ...feeding,
              id: 'stale',
            },
          ]),
        );

        const result =
          await service.load();

        expect(
          result.feedings[0].id,
        ).toBe('feeding-1');

        expect(
          repository.saveRecords,
        ).not.toHaveBeenCalled();

        expect(
          localStorage.getItem(
            feedingKey,
          ),
        ).toBeNull();
      },
    );

    it(
      'mantém os dados locais quando a migração falha',
      async () => {
        localStorage.setItem(
          feedingKey,
          JSON.stringify([
            feeding,
          ]),
        );

        repository
          .saveRecords
          .and.rejectWith(
            new Error(
              'Firestore indisponível',
            ),
          );

        await expectAsync(
          service.load(),
        ).toBeRejected();

        expect(
          localStorage.getItem(
            feedingKey,
          ),
        ).not.toBeNull();

        expect(
          repository.saveProfile,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'converte mamadas da versão antiga sem períodos',
      async () => {
        localStorage.setItem(
          legacyFeedingKey,
          JSON.stringify([
            {
              id:
                'legacy-feeding',

              startedAt:
                1000,

              endedAt:
                2000,

              side:
                'right',
            },
          ]),
        );

        const result =
          await service.load();

        expect(
          result.feedings[0],
        ).toEqual({
          id:
            'legacy-feeding',

          startedAt:
            1000,

          endedAt:
            2000,

          side:
            'right',

          periods:
            null,
        });
      },
    );

    it(
      'não apaga armazenamento local inválido',
      async () => {
        localStorage.setItem(
          feedingKey,
          '{inválido',
        );

        await expectAsync(
          service.load(),
        ).toBeRejected();

        expect(
          localStorage.getItem(
            feedingKey,
          ),
        ).toBe(
          '{inválido',
        );

        expect(
          repository.saveProfile,
        ).not.toHaveBeenCalled();
      },
    );
  },
);