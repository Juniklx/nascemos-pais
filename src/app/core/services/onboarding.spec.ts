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
  OnboardingPersistenceService,
} from './onboarding-persistence';

import {
  OnboardingService,
} from './onboarding';

describe(
  'OnboardingService',
  () => {
    let service:
      OnboardingService;

    let userState:
      ReturnType<
        typeof signal<User | null>
      >;

    let auth: {
      user:
      ReturnType<
        typeof signal<User | null>
      >['asReadonly'] extends
      () => infer T
      ? T
      : never;

      waitUntilReady:
      jasmine.Spy;
    };

    let persistence: {
      load:
      jasmine.Spy;

      save:
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
      userState =
        signal<User | null>(
          {
            uid: 'user-a',
          } as User,
        );

      auth = {
        user:
          userState.asReadonly(),

        waitUntilReady:
          jasmine
            .createSpy(
              'waitUntilReady',
            )
            .and.resolveTo(),
      };

      persistence = {
        load:
          jasmine
            .createSpy('load')
            .and.resolveTo(null),

        save:
          jasmine
            .createSpy('save')
            .and.resolveTo(),
      };

      TestBed
        .configureTestingModule({
          providers: [
            OnboardingService,

            {
              provide:
                AuthService,

              useValue:
                auth,
            },

            {
              provide:
                OnboardingPersistenceService,

              useValue:
                persistence,
            },
          ],
        });

      service =
        TestBed.inject(
          OnboardingService,
        );
    });

    afterEach(() => {
      TestBed
        .resetTestingModule();
    });

    it(
      'carrega o perfil do usuário autenticado',
      async () => {
        persistence.load
          .and.resolveTo(
            completeData,
          );

        await service
          .ensureLoaded();

        expect(
          service.caregiverName(),
        ).toBe('Marcelo');

        expect(
          service.babyName(),
        ).toBe('Bebê');

        expect(
          service.isComplete(),
        ).toBeTrue();

        expect(
          service.getIncompleteRoute(),
        ).toBe('/home');
      },
    );

    it(
      'registra consentimento e salva na nuvem',
      async () => {
        await service
          .ensureLoaded();

        const saved =
          await service
            .setCaregiverName(
              'Marcelo',
              true,
            );

        expect(saved)
          .toBeTrue();

        expect(
          service.consentGiven(),
        ).toBeTrue();

        expect(
          service.consentAt(),
        ).not.toBeNull();

        expect(
          persistence.save,
        ).toHaveBeenCalled();

        const savedData =
          persistence.save
            .calls
            .mostRecent()
            .args[0];

        expect(
          savedData.caregiverName,
        ).toBe('Marcelo');

        expect(
          savedData.consentGiven,
        ).toBeTrue();

        expect(
          typeof savedData.consentAt,
        ).toBe('string');
      },
    );

    it(
      'não aceita cadastro sem consentimento',
      async () => {
        const saved =
          await service
            .setCaregiverName(
              'Marcelo',
              false,
            );

        expect(saved)
          .toBeFalse();

        expect(
          persistence.save,
        ).not.toHaveBeenCalled();

        expect(
          service.consentGiven(),
        ).toBeFalse();
      },
    );

    it(
      'preserva a data original do consentimento',
      async () => {
        await service
          .ensureLoaded();

        await service
          .setCaregiverName(
            'Marcelo',
            true,
          );

        const consentAt =
          service.consentAt();

        await service
          .setCaregiverName(
            'Marcelo Soares',
            true,
          );

        expect(
          service.consentAt(),
        ).toBe(consentAt);
      },
    );

    it(
      'considera o onboarding completo depois de salvar os dados do bebê',
      async () => {
        await service
          .ensureLoaded();

        await service
          .setCaregiverName(
            'Marcelo',
            true,
          );

        const saved =
          await service
            .setBabyData(
              'Bebê',
              '2026-01-01',
            );

        expect(saved)
          .toBeTrue();

        expect(
          service.isComplete(),
        ).toBeTrue();

        expect(
          service.getIncompleteRoute(),
        ).toBe('/home');
      },
    );

    it(
      'mantém onboarding incompleto sem consentimento',
      async () => {
        persistence.load
          .and.resolveTo({
            caregiverName:
              'Marcelo',

            babyName:
              'Bebê',

            babyBirthDate:
              '2026-01-01',

            consentGiven:
              false,

            consentAt:
              null,
          });

        await service
          .ensureLoaded();

        expect(
          service.isComplete(),
        ).toBeFalse();

        expect(
          service.getIncompleteRoute(),
        ).toBe(
          '/onboarding/about-you',
        );
      },
    );

    it(
      'não altera o estado quando o salvamento falha',
      async () => {
        await service
          .ensureLoaded();

        persistence.save
          .and.rejectWith(
            new Error(
              'Firestore indisponível',
            ),
          );

        const saved =
          await service
            .setCaregiverName(
              'Marcelo',
              true,
            );

        expect(saved)
          .toBeFalse();

        expect(
          service.caregiverName(),
        ).toBe('');

        expect(
          service.consentGiven(),
        ).toBeFalse();

        expect(
          service.storageError(),
        ).toContain(
          'Não foi possível salvar',
        );
      },
    );

    it(
      'não permite salvar se o perfil não puder ser carregado',
      async () => {
        persistence.load
          .and.rejectWith(
            new Error(
              'Firestore indisponível',
            ),
          );

        await service
          .ensureLoaded();

        expect(
          service.isReady(),
        ).toBeFalse();

        expect(
          service.storageError(),
        ).toContain(
          'Não foi possível carregar',
        );

        const saved =
          await service
            .setCaregiverName(
              'Marcelo',
              true,
            );

        expect(saved)
          .toBeFalse();

        expect(
          persistence.save,
        ).not.toHaveBeenCalled();
      },
    );
  },
);