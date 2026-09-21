import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlTree,
} from '@angular/router';

import {
  authGuard,
} from './auth.guard';

import {
  AuthService,
} from '../services/auth';

describe('authGuard', () => {
  it(
    'permite acesso quando existe sessão',
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
            provide: Router,
            useValue: router,
          },
        ],
      });

      const result =
        await TestBed.runInInjectionContext(
          () =>
            authGuard(
              {} as never,
              {} as never,
            ),
        );

      expect(result).toBeTrue();

      expect(
        auth.waitUntilReady,
      ).toHaveBeenCalled();

      expect(
        auth.isAuthenticated,
      ).toHaveBeenCalled();

      expect(
        router.createUrlTree,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'redireciona para login sem sessão',
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
            provide: Router,
            useValue: router,
          },
        ],
      });

      const result =
        await TestBed.runInInjectionContext(
          () =>
            authGuard(
              {} as never,
              {} as never,
            ),
        );

      expect(result).toBe(
        expectedTree,
      );

      expect(
        auth.waitUntilReady,
      ).toHaveBeenCalled();

      expect(
        router.createUrlTree,
      ).toHaveBeenCalledOnceWith([
        '/auth/login',
      ]);
    },
  );
});