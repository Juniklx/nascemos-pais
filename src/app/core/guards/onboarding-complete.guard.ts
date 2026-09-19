import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { OnboardingService } from '../services/onboarding';

export const onboardingCompleteGuard: CanActivateFn =
  () => {
    const onboarding = inject(OnboardingService);
    const router = inject(Router);

    if (onboarding.isComplete()) {
      return true;
    }

    return router.createUrlTree([
      onboarding.getIncompleteRoute(),
    ]);
  };