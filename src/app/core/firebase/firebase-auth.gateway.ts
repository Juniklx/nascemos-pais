import {
  Injectable,
  inject,
} from '@angular/core';

import {
  GoogleAuthProvider,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  Unsubscribe,
} from 'firebase/auth';

import {
  FIREBASE_AUTH,
} from './firebase-auth';

@Injectable({
  providedIn: 'root',
})
export class FirebaseAuthGateway {
  private readonly auth =
    inject(FIREBASE_AUTH);

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  waitUntilReady(): Promise<void> {
    return this.auth.authStateReady();
  }

  observe(
    next: (user: User | null) => void,
    error?: (error: Error) => void,
  ): Unsubscribe {
    return onAuthStateChanged(
      this.auth,
      next,
      error,
    );
  }

  register(
    email: string,
    password: string,
  ): Promise<UserCredential> {
    return createUserWithEmailAndPassword(
      this.auth,
      email,
      password,
    );
  }

  login(
    email: string,
    password: string,
  ): Promise<UserCredential> {
    return signInWithEmailAndPassword(
      this.auth,
      email,
      password,
    );
  }

  loginWithGoogle():
    Promise<UserCredential> {
    const provider =
      new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account',
    });

    return signInWithPopup(
      this.auth,
      provider,
    );
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
}