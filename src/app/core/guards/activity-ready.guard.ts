import {
  inject,
} from '@angular/core';

import {
  CanActivateFn,
} from '@angular/router';

import {
  ActivityPersistenceService,
} from '../services/activity-persistence';

export const activityReadyGuard:
  CanActivateFn =
  async () => {
    const persistence =
      inject(
        ActivityPersistenceService,
      );

    try {
      await persistence.load();
    } catch {
      /*
       * O próprio serviço mantém o erro
       * reativo. Permitimos a navegação
       * para que a interface possa exibir
       * a falha e o usuário possa tentar
       * novamente sem perder dados locais.
       */
    }

    return true;
  };