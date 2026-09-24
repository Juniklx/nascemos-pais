import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { BabyContextService } from '../services/baby-context';
import { OnboardingService } from '../services/onboarding';

export const onboardingCompleteGuard: CanActivateFn = async () => {
  const onboarding = inject(OnboardingService);
  const babyContext = inject(BabyContextService);
  const router = inject(Router);

  await onboarding.ensureLoaded();

  if (onboarding.isComplete()) {
    return true;
  }

  /*
   * Um responsável que acabou de aceitar
   * um convite pode já possuir activeBabyId,
   * enquanto nome e data do bebê ainda não
   * foram sincronizados no perfil.
   *
   * Antes de tratá-lo como onboarding
   * incompleto, tentamos concluir essa
   * sincronização através do contexto
   * compartilhado.
   */
  if (onboarding.getIncompleteRoute() === '/onboarding/about-baby') {
    try {
      await babyContext.ensureLoaded();

      await onboarding.reload();

      if (onboarding.isComplete()) {
        return true;
      }
    } catch {
      /*
       * Para um usuário realmente sem bebê,
       * BabyContextService não conseguirá
       * carregar nada. Nesse caso seguimos
       * normalmente para o cadastro.
       */
    }
  }

  return router.createUrlTree([onboarding.getIncompleteRoute()]);
};