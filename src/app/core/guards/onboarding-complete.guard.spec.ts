import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { onboardingCompleteGuard } from './onboarding-complete.guard';
import { OnboardingService } from '../services/onboarding';

describe('onboardingCompleteGuard: consentimento', () => {
  it('bloqueia rotas internas sem consentimento', () => {
    const onboarding = {
      isComplete: jasmine
        .createSpy('isComplete')
        .and.returnValue(false),

      getIncompleteRoute: jasmine
        .createSpy('getIncompleteRoute')
        .and.returnValue('/onboarding/about-you'),
    };

    const expectedTree = {} as UrlTree;

    const router = {
      createUrlTree: jasmine
        .createSpy('createUrlTree')
        .and.returnValue(expectedTree),
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

    const result = TestBed.runInInjectionContext(
      () =>
        onboardingCompleteGuard(
          {} as never,
          {} as never,
        ),
    );

    expect(result).toBe(expectedTree);

    expect(
      onboarding.getIncompleteRoute,
    ).toHaveBeenCalled();

    expect(
      router.createUrlTree,
    ).toHaveBeenCalledOnceWith([
      '/onboarding/about-you',
    ]);
  });

  it('permite acesso quando o onboarding está completo', () => {
    const onboarding = {
      isComplete: jasmine
        .createSpy('isComplete')
        .and.returnValue(true),

      getIncompleteRoute: jasmine
        .createSpy('getIncompleteRoute'),
    };

    const router = {
      createUrlTree: jasmine.createSpy(
        'createUrlTree',
      ),
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

    const result = TestBed.runInInjectionContext(
      () =>
        onboardingCompleteGuard(
          {} as never,
          {} as never,
        ),
    );

    expect(result).toBeTrue();

    expect(
      router.createUrlTree,
    ).not.toHaveBeenCalled();
  });
});