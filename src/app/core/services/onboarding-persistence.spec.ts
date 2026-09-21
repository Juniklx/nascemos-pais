import {
  TestBed,
} from '@angular/core/testing';

import {
  OnboardingPersistenceService,
} from './onboarding-persistence';

import {
  UserDataRepository,
} from './user-data.repository';

describe(
  'OnboardingPersistenceService',
  () => {
    const storageKey =
      'nascemos-pais:onboarding';

    let service:
      OnboardingPersistenceService;

    let repository: {
      readProfile:
        jasmine.Spy;

      saveProfile:
        jasmine.Spy;
    };

    const completeData = {
      caregiverName:
        'Marcelo',

      babyName:
        'Bebê',

      babyBirthDate:
        '2026-01-01',

      consentGiven:
        true,

      consentAt:
        '2026-09-20T12:00:00.000Z',
    };

    beforeEach(() => {
      localStorage.clear();

      repository = {
        readProfile:
          jasmine.createSpy(
            'readProfile',
          ),

        saveProfile:
          jasmine.createSpy(
            'saveProfile',
          ),
      };

      TestBed.configureTestingModule({
        providers: [
          OnboardingPersistenceService,

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
          OnboardingPersistenceService,
        );
    });

    afterEach(() => {
      localStorage.clear();

      TestBed.resetTestingModule();
    });

    it(
      'prioriza o perfil já existente no Firestore',
      async () => {
        repository.readProfile
          .and.resolveTo({
            ...completeData,

            createdAt:
              '2026-09-20T10:00:00.000Z',

            updatedAt:
              '2026-09-20T12:00:00.000Z',
          });

        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...completeData,

            caregiverName:
              'Outro nome',
          }),
        );

        const result =
          await service.load();

        expect(
          result?.caregiverName,
        ).toBe('Marcelo');

        expect(
          repository.saveProfile,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'migra dados locais quando não existe perfil no Firestore',
      async () => {
        repository.readProfile
          .and.resolveTo(null);

        repository.saveProfile
          .and.resolveTo();

        localStorage.setItem(
          storageKey,
          JSON.stringify(
            completeData,
          ),
        );

        const result =
          await service.load();

        expect(result).toEqual(
          completeData,
        );

        expect(
          repository.saveProfile,
        ).toHaveBeenCalled();

        const saved =
          repository.saveProfile
            .calls
            .mostRecent()
            .args[0];

        expect(saved).toEqual(
          jasmine.objectContaining({
            ...completeData,

            legacyMigrationVersion:
              1,
          }),
        );

        expect(
          typeof saved.createdAt,
        ).toBe('string');

        expect(
          typeof saved.updatedAt,
        ).toBe('string');

        expect(
          localStorage.getItem(
            storageKey,
          ),
        ).toBeNull();
      },
    );

    it(
      'mantém os dados locais se a migração falhar',
      async () => {
        repository.readProfile
          .and.resolveTo(null);

        repository.saveProfile
          .and.rejectWith(
            new Error(
              'Firestore indisponível',
            ),
          );

        localStorage.setItem(
          storageKey,
          JSON.stringify(
            completeData,
          ),
        );

        await expectAsync(
          service.load(),
        ).toBeRejected();

        expect(
          localStorage.getItem(
            storageKey,
          ),
        ).not.toBeNull();
      },
    );

    it(
      'migra cadastro antigo sem consentimento como incompleto',
      async () => {
        repository.readProfile
          .and.resolveTo(null);

        repository.saveProfile
          .and.resolveTo();

        localStorage.setItem(
          storageKey,
          JSON.stringify({
            caregiverName:
              'Marcelo',

            babyName:
              'Bebê',

            babyBirthDate:
              '2026-01-01',
          }),
        );

        const result =
          await service.load();

        expect(
          result?.consentGiven,
        ).toBeFalse();

        expect(
          result?.consentAt,
        ).toBeNull();
      },
    );

    it(
      'salva um novo perfil com metadados',
      async () => {
        repository.readProfile
          .and.resolveTo(null);

        repository.saveProfile
          .and.resolveTo();

        await service.load();

        await service.save(
          completeData,
        );

        const saved =
          repository.saveProfile
            .calls
            .mostRecent()
            .args[0];

        expect(saved).toEqual(
          jasmine.objectContaining(
            completeData,
          ),
        );

        expect(
          typeof saved.createdAt,
        ).toBe('string');

        expect(
          typeof saved.updatedAt,
        ).toBe('string');
      },
    );
  },
);