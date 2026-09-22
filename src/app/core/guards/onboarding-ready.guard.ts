import {
  inject,
} from '@angular/core';

import {
  CanActivateFn,
} from '@angular/router';

import {
  OnboardingService,
} from '../services/onboarding';

export const onboardingReadyGuard:
  CanActivateFn =
  async () => {
    const onboarding =
      inject(
        OnboardingService,
      );

    await onboarding
      .ensureLoaded();

    return true;
  };