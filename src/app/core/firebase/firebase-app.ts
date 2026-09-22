import {
  InjectionToken,
} from '@angular/core';

import {
  FirebaseApp,
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';

import {
  environment,
} from '../../../environments/environment';

export const FIREBASE_APP =
  new InjectionToken<FirebaseApp>(
    'FIREBASE_APP',
    {
      providedIn: 'root',

      factory: () =>
        getApps().length > 0
          ? getApp()
          : initializeApp(
              environment.firebase,
            ),
    },
  );