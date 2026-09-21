import {
  FirebaseOptions,
} from 'firebase/app';

export const environment: {
  production: boolean;
  firebase: FirebaseOptions;
} = {
  production: true,

  firebase: {
    apiKey:
      'AIzaSyAYdUs33XklYTBkRUUlq2jt26MuGlSoo-8',

    authDomain:
      'nascemos-pais.firebaseapp.com',

    projectId:
      'nascemos-pais',

    storageBucket:
      'nascemos-pais.firebasestorage.app',

    messagingSenderId:
      '783158011811',

    appId:
      '1:783158011811:web:1bbc43ba5c7d4ecde91c16',

    measurementId:
      'G-BFL72F43K1',
  },
};