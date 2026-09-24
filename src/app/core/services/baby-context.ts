import { Injectable, computed, inject, signal } from '@angular/core'
import type { Baby, BabyMember } from '../models/baby';
import { AuthService } from './auth';
import { BabyDataRepository } from './baby-data.repository';
import { BabyMigrationService } from './baby-migration';

interface BabyContextState {
  readonly uid: string | null;

  readonly baby: Baby | null;

  readonly membership: BabyMember | null;

  readonly ready: boolean;

  readonly loading: boolean;

  readonly error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class BabyContextService {
  private readonly auth = inject(AuthService);

  private readonly babies = inject(BabyDataRepository);

  private readonly migration = inject(BabyMigrationService);

  private readonly state = signal<BabyContextState>({
    uid: null,
    baby: null,
    membership: null,
    ready: false,
    loading: false,
    error: null,
  });

  private loadingUid: string | null = null;

  private loadPromise: Promise<void> | null = null;

  readonly baby = computed(() => {
    const uid = this.auth.user()?.uid ?? null;

    const state = this.state();

    if (uid === null || state.uid !== uid) {
      return null;
    }

    return state.baby;
  });

  readonly membership = computed(() => {
    const uid = this.auth.user()?.uid ?? null;

    const state = this.state();

    if (uid === null || state.uid !== uid) {
      return null;
    }

    return state.membership;
  });

  readonly activeBabyId = computed(() => this.baby()?.id ?? null);

  readonly isOwner = computed(() => this.membership()?.role === 'owner');

  readonly isReady = computed(() => {
    const uid = this.auth.user()?.uid ?? null;

    const state = this.state();

    return uid !== null && state.uid === uid && state.ready;
  });

  readonly isLoading = computed(() => {
    const uid = this.auth.user()?.uid ?? null;

    const state = this.state();

    return uid !== null && state.uid === uid && state.loading;
  });

  readonly error = computed(() => {
    const uid = this.auth.user()?.uid ?? null;

    const state = this.state();

    if (uid === null || state.uid !== uid) {
      return null;
    }

    return state.error;
  });

  async ensureLoaded(): Promise<void> {
    await this.auth.waitUntilReady();

    const uid = this.auth.user()?.uid ?? null;

    if (uid === null) {
      this.clearState();

      throw new Error('Usuário não autenticado.');
    }

    const current = this.state();

    if (current.uid === uid && current.ready) {
      return;
    }

    if (this.loadingUid === uid && this.loadPromise !== null) {
      return this.loadPromise;
    }

    this.state.set({
      uid,
      baby: null,
      membership: null,
      ready: false,
      loading: true,
      error: null,
    });

    this.loadingUid = uid;

    const promise = this.loadForUser(uid);

    this.loadPromise = promise;

    try {
      await promise;
    } catch (error) {
      if (this.auth.user()?.uid === uid) {
        this.state.set({
          uid,
          baby: null,
          membership: null,
          ready: false,
          loading: false,
          error: 'Não foi possível carregar os dados do bebê.',
        });
      }

      throw error;
    } finally {
      if (this.loadPromise === promise) {
        this.loadPromise = null;

        this.loadingUid = null;
      }
    }
  }

  reset(): void {
    this.clearState();
  }

  async reload(): Promise<void> {
    /*
     * Usado quando o bebê ativo muda,
     * por exemplo após aceitar um convite.
     */
    this.clearState();

    await this.ensureLoaded();
  }

  private async loadForUser(uid: string): Promise<void> {
    const babyId = await this.migration.ensureMigrated();

    this.assertSameUser(uid);

    if (babyId === null) {
      throw new Error('Bebê ativo não encontrado.');
    }

    const [baby, membership] = await Promise.all([
      this.babies.readBaby(babyId),

      this.babies.readMembership(babyId),
    ]);

    this.assertSameUser(uid);

    if (baby === null || membership === null) {
      throw new Error('O vínculo com o bebê está inconsistente.');
    }

    this.state.set({
      uid,
      baby,
      membership,
      ready: true,
      loading: false,
      error: null,
    });
  }

  private clearState(): void {
    this.state.set({
      uid: null,
      baby: null,
      membership: null,
      ready: false,
      loading: false,
      error: null,
    });

    this.loadingUid = null;

    this.loadPromise = null;
  }

  private assertSameUser(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A sessão mudou durante o carregamento do bebê.');
    }
  }
}
