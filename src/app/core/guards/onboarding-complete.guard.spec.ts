import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { BabyContextService } from '../services/baby-context';
import { onboardingCompleteGuard } from './onboarding-complete.guard';
import { OnboardingService } from '../services/onboarding';

describe('onboardingCompleteGuard', () => {
  it('aguarda os dados e bloqueia onboarding incompleto', async () => {
    const onboarding = {
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),

      isComplete: jasmine.createSpy('isComplete').and.returnValue(false),

      getIncompleteRoute: jasmine
        .createSpy('getIncompleteRoute')
        .and.returnValue('/onboarding/about-you'),
    };

    const babyContext = {
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),
    };

    const expectedTree = {} as UrlTree;

    const router = {
      createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue(expectedTree),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingService,

          useValue: onboarding,
        },
        {
          provide: Router,

          useValue: router,
        },
        {
          provide: BabyContextService,
          useValue: babyContext,
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard({} as never, {} as never),
    );

    expect(onboarding.ensureLoaded).toHaveBeenCalled();

    expect(result).toBe(expectedTree);
  });

  it('permite acesso com onboarding completo', async () => {
    const onboarding = {
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),

      isComplete: jasmine.createSpy('isComplete').and.returnValue(true),

      getIncompleteRoute: jasmine.createSpy('getIncompleteRoute'),
    };

    const router = {
      createUrlTree: jasmine.createSpy('createUrlTree'),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingService,

          useValue: onboarding,
        },
        {
          provide: Router,

          useValue: router,
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard({} as never, {} as never),
    );

    expect(result).toBeTrue();

    expect(onboarding.ensureLoaded).toHaveBeenCalled();
  });

  it('sincroniza bebê compartilhado antes de redirecionar para o onboarding', async () => {
    let complete = false;

    const onboarding = {
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),

      reload: jasmine.createSpy('reload').and.callFake(async () => {
        complete = true;
      }),

      isComplete: jasmine.createSpy('isComplete').and.callFake(() => complete),

      getIncompleteRoute: jasmine
        .createSpy('getIncompleteRoute')
        .and.returnValue('/onboarding/about-baby'),
    };

    const babyContext = {
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),
    };

    const router = {
      createUrlTree: jasmine.createSpy('createUrlTree'),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingService,
          useValue: onboarding,
        },
        {
          provide: BabyContextService,
          useValue: babyContext,
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard({} as never, {} as never),
    );

    expect(result).toBeTrue();
    expect(babyContext.ensureLoaded).toHaveBeenCalled();
    expect(onboarding.reload).toHaveBeenCalled();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });
});
