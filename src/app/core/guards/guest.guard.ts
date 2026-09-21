import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import {
  AuthService,
} from '../services/auth';

import {
  OnboardingService,
} from '../services/onboarding';

export const guestGuard: CanActivateFn =
  async () => {
    const auth = inject(AuthService);
    const onboarding =
      inject(OnboardingService);
    const router = inject(Router);

    await auth.waitUntilReady();

    if (!auth.isAuthenticated()) {
      return true;
    }

    return router.createUrlTree([
      onboarding.getIncompleteRoute(),
    ]);
  };