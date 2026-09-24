import { Injectable, computed, inject, signal } from '@angular/core';
import type { Baby, BabyMember, LinkedBaby } from '../models/baby';
import { AuthService } from './auth';
import { BabyDataRepository } from './baby-data.repository';
import { BabyMigrationService } from './baby-migration';

interface BabyContextState {
  readonly uid: string | null;
  readonly baby: Baby | null;
  readonly membership: BabyMember | null;
  readonly linkedBabies: readonly LinkedBaby[];
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
    linkedBabies: [],
    ready: false,
    loading: false,
    error: null,
  });

  private loadingUid: string | null = null;
  private loadPromise: Promise<void> | null = null;

  readonly baby = computed(() => this.currentState()?.baby ?? null);
  readonly membership = computed(() => this.currentState()?.membership ?? null);
  readonly linkedBabies = computed(() => this.currentState()?.linkedBabies ?? []);
  readonly activeBabyId = computed(() => this.baby()?.id ?? null);
  readonly isOwner = computed(() => this.membership()?.role === 'owner');

  readonly isReady = computed(() => {
    const state = this.currentState();

    return state !== null && state.ready;
  });

  readonly isLoading = computed(() => {
    const state = this.currentState();

    return state !== null && state.loading;
  });

  readonly error = computed(() => this.currentState()?.error ?? null);

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
      linkedBabies: [],
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
          linkedBabies: [],
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

  async createBaby(input: { readonly name: string; readonly birthDate: string }): Promise<Baby> {
    await this.ensureLoaded();

    const uid = this.auth.user()?.uid ?? null;

    if (uid === null) {
      throw new Error('Usuário não autenticado.');
    }

    const baby = await this.babies.createOwnedBaby(input);

    this.assertSameUser(uid);

    await this.reload();

    this.assertSameUser(uid);

    return baby;
  }

  async selectBaby(babyId: string): Promise<void> {
    await this.ensureLoaded();

    const uid = this.auth.user()?.uid ?? null;

    if (uid === null) {
      throw new Error('Usuário não autenticado.');
    }

    if (this.activeBabyId() === babyId) {
      return;
    }

    const current = this.state();

    this.state.set({
      ...current,
      loading: true,
      error: null,
    });

    try {
      const selected = await this.babies.setActiveBaby(babyId);

      this.assertSameUser(uid);

      const linkedBabies = await this.babies.listLinkedBabies();

      this.assertSameUser(uid);

      this.state.set({
        uid,
        baby: selected.baby,
        membership: selected.membership,
        linkedBabies: this.withSelectedBaby(linkedBabies, selected),
        ready: true,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (this.auth.user()?.uid === uid) {
        this.state.set({
          ...current,
          loading: false,
          error: 'Não foi possível trocar o bebê selecionado.',
        });
      }

      throw error;
    }
  }

  reset(): void {
    this.clearState();
  }

  async reload(): Promise<void> {
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

    await this.babies.ensureBabyReference(babyId, membership);

    this.assertSameUser(uid);

    const linkedBabies = await this.babies.listLinkedBabies();

    this.assertSameUser(uid);

    const selected: LinkedBaby = {
      baby,
      membership,
    };

    this.state.set({
      uid,
      baby,
      membership,
      linkedBabies: this.withSelectedBaby(linkedBabies, selected),
      ready: true,
      loading: false,
      error: null,
    });
  }

  private withSelectedBaby(
    linkedBabies: readonly LinkedBaby[],
    selected: LinkedBaby,
  ): readonly LinkedBaby[] {
    const withoutSelected = linkedBabies.filter((item) => item.baby.id !== selected.baby.id);

    return [selected, ...withoutSelected].sort((a, b) =>
      a.baby.name.localeCompare(b.baby.name, 'pt-BR'),
    );
  }

  private currentState(): BabyContextState | null {
    const uid = this.auth.user()?.uid ?? null;
    const state = this.state();

    if (uid === null || state.uid !== uid) {
      return null;
    }

    return state;
  }

  private clearState(): void {
    this.state.set({
      uid: null,
      baby: null,
      membership: null,
      linkedBabies: [],
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
