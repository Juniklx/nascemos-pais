import {
  InjectionToken,
  inject,
} from '@angular/core';

import {
  Firestore,
  getFirestore,
} from 'firebase/firestore';

import {
  FIREBASE_APP,
} from './firebase-app';

export const FIREBASE_FIRESTORE =
  new InjectionToken<Firestore>(
    'FIREBASE_FIRESTORE',
    {
      providedIn: 'root',

      factory: () =>
        getFirestore(
          inject(FIREBASE_APP),
        ),
    },
  );