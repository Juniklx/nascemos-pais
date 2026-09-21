import {
  InjectionToken,
} from '@angular/core';

import {
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';

import {
  Auth,
  getAuth,
} from 'firebase/auth';

import {
  environment,
} from '../../../environments/environment';

export const FIREBASE_AUTH =
  new InjectionToken<Auth>(
    'FIREBASE_AUTH',
    {
      providedIn: 'root',

      factory: () => {
        const app =
          getApps().length > 0
            ? getApp()
            : initializeApp(
                environment.firebase,
              );

        return getAuth(app);
      },
    },
  );