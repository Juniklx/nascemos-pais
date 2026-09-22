import {
  TestBed,
} from '@angular/core/testing';

import {
  onboardingReadyGuard,
} from './onboarding-ready.guard';

import {
  OnboardingService,
} from '../services/onboarding';

describe(
  'onboardingReadyGuard',
  () => {
    it(
      'aguarda o carregamento do perfil',
      async () => {
        const onboarding = {
          ensureLoaded:
            jasmine
              .createSpy(
                'ensureLoaded',
              )
              .and.resolveTo(),
        };

        TestBed
          .configureTestingModule({
            providers: [
              {
                provide:
                  OnboardingService,

                useValue:
                  onboarding,
              },
            ],
          });

        const result =
          await TestBed
            .runInInjectionContext(
              () =>
                onboardingReadyGuard(
                  {} as never,
                  {} as never,
                ),
            );

        expect(result)
          .toBeTrue();

        expect(
          onboarding.ensureLoaded,
        ).toHaveBeenCalled();
      },
    );
  },
);