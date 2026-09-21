import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlTree,
} from '@angular/router';

import {
  guestGuard,
} from './guest.guard';

import {
  AuthService,
} from '../services/auth';

import {
  OnboardingService,
} from '../services/onboarding';

describe('guestGuard', () => {
  it(
    'permite acesso quando não existe sessão',
    async () => {
      const auth = {
        waitUntilReady:
          jasmine
            .createSpy('waitUntilReady')
            .and.resolveTo(),

        isAuthenticated:
          jasmine
            .createSpy('isAuthenticated')
            .and.returnValue(false),
      };

      const onboarding = {
        getIncompleteRoute:
          jasmine.createSpy(
            'getIncompleteRoute',
          ),
      };

      const router = {
        createUrlTree:
          jasmine.createSpy(
            'createUrlTree',
          ),
      };

      TestBed.configureTestingModule({
        providers: [
          {
            provide: AuthService,
            useValue: auth,
          },
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

      const result =
        await TestBed.runInInjectionContext(
          () =>
            guestGuard(
              {} as never,
              {} as never,
            ),
        );

      expect(result).toBeTrue();

      expect(
        router.createUrlTree,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'redireciona usuário autenticado',
    async () => {
      const auth = {
        waitUntilReady:
          jasmine
            .createSpy('waitUntilReady')
            .and.resolveTo(),

        isAuthenticated:
          jasmine
            .createSpy('isAuthenticated')
            .and.returnValue(true),
      };

      const onboarding = {
        getIncompleteRoute:
          jasmine
            .createSpy('getIncompleteRoute')
            .and.returnValue('/home'),
      };

      const expectedTree =
        {} as UrlTree;

      const router = {
        createUrlTree:
          jasmine
            .createSpy('createUrlTree')
            .and.returnValue(
              expectedTree,
            ),
      };

      TestBed.configureTestingModule({
        providers: [
          {
            provide: AuthService,
            useValue: auth,
          },
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

      const result =
        await TestBed.runInInjectionContext(
          () =>
            guestGuard(
              {} as never,
              {} as never,
            ),
        );

      expect(result).toBe(
        expectedTree,
      );

      expect(
        onboarding.getIncompleteRoute,
      ).toHaveBeenCalled();

      expect(
        router.createUrlTree,
      ).toHaveBeenCalledOnceWith([
        '/home',
      ]);
    },
  );
});