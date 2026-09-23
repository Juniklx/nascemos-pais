import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AccessRemovalService } from '../services/access-removal';

export const accessRemovalGuard: CanActivateFn = async () => {
  const accessRemoval = inject(AccessRemovalService);
  const router = inject(Router);

  await accessRemoval.load();

  if (accessRemoval.notification()) {
    return router.createUrlTree(['/access-removed']);
  }

  return true;
};