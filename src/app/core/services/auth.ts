import {
  Injectable,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  User,
} from 'firebase/auth';

import {
  FirebaseAuthGateway,
} from '../firebase/firebase-auth.gateway';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly gateway =
    inject(FirebaseAuthGateway);

  private readonly userState =
    signal<User | null>(null);

  private readonly readyState =
    signal(false);

  private readonly loadingState =
    signal(false);

  private readonly errorState =
    signal<string | null>(null);

  private readonly unsubscribe =
    this.gateway.observe(
      (user) => {
        this.userState.set(user);
        this.readyState.set(true);
      },
      () => {
        this.userState.set(null);
        this.readyState.set(true);
      },
    );

  readonly user =
    this.userState.asReadonly();

  readonly isReady =
    this.readyState.asReadonly();

  readonly isLoading =
    this.loadingState.asReadonly();

  readonly error =
    this.errorState.asReadonly();

  readonly isAuthenticated = computed(
    () => this.user() !== null,
  );

  readonly email = computed(
    () => this.user()?.email ?? '',
  );

  readonly displayName = computed(
    () => this.user()?.displayName ?? '',
  );

  async waitUntilReady(): Promise<void> {
    await this.gateway.waitUntilReady();

    this.userState.set(
      this.gateway.currentUser,
    );

    this.readyState.set(true);
  }

  async register(
    email: string,
    password: string,
  ): Promise<boolean> {
    this.startOperation();

    try {
      await this.gateway.register(
        email.trim(),
        password,
      );

      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    } finally {
      this.loadingState.set(false);
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<boolean> {
    this.startOperation();

    try {
      await this.gateway.login(
        email.trim(),
        password,
      );

      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    } finally {
      this.loadingState.set(false);
    }
  }

  async loginWithGoogle():
    Promise<boolean> {
    this.startOperation();

    try {
      await this.gateway
        .loginWithGoogle();

      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    } finally {
      this.loadingState.set(false);
    }
  }

  async logout(): Promise<boolean> {
    this.startOperation();

    try {
      await this.gateway.logout();

      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    } finally {
      this.loadingState.set(false);
    }
  }

  clearError(): void {
    this.errorState.set(null);
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  private startOperation(): void {
    this.errorState.set(null);
    this.loadingState.set(true);
  }

  private handleError(
    error: unknown,
  ): void {
    const code =
      this.getErrorCode(error);

    console.warn('Firebase Authentication:', code || 'erro sem código');

    this.errorState.set(
      this.getErrorMessage(code),
    );
  }

  private getErrorCode(
    error: unknown,
  ): string {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : '';
  }

  private getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return (
          'Este e-mail já possui uma conta. ' +
          'Tente entrar em vez de criar uma nova.'
        );

      case 'auth/invalid-email':
        return 'Informe um e-mail válido.';

      case 'auth/weak-password':
        return (
          'A senha não atende aos requisitos ' +
          'de segurança.'
        );

      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return (
          'E-mail ou senha incorretos. ' +
          'Confira os dados e tente novamente.'
        );

      case 'auth/user-disabled':
        return 'Esta conta está desativada.';

      case 'auth/popup-closed-by-user':
        return (
          'O login com Google foi cancelado.'
        );

      case 'auth/popup-blocked':
        return (
          'O navegador bloqueou a janela de login. ' +
          'Permita pop-ups e tente novamente.'
        );

      case 'auth/cancelled-popup-request':
        return (
          'Já existe uma tentativa de login ' +
          'com Google em andamento.'
        );

      case 'auth/account-exists-with-different-credential':
        return (
          'Já existe uma conta com este e-mail ' +
          'usando outro método de login.'
        );

      case 'auth/network-request-failed':
        return (
          'Não foi possível conectar ao serviço ' +
          'de autenticação. Verifique sua internet.'
        );

      case 'auth/too-many-requests':
        return (
          'Muitas tentativas foram realizadas. ' +
          'Aguarde um pouco e tente novamente.'
        );

      case 'auth/operation-not-allowed':
        return (
          'Este método de login não está habilitado.'
        );

      case 'auth/unauthorized-domain':
        return (
          'Este endereço não está autorizado para entrar com Google. ' +
          'Use o endereço oficial do site ou peça ao responsável para liberar o domínio.'
        );

      case 'auth/invalid-api-key':
        return 'A configuração da autenticação está inválida. Avise o responsável pelo site.';

      default:
        return (
          'Não foi possível concluir a autenticação. ' +
          'Tente novamente.'
        );
    }
  }
}
