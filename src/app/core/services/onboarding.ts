import {
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  isValidBirthDate,
  isValidName,
} from '../validators/onboarding.validators';

import {
  AuthService,
} from './auth';

import {
  OnboardingPersistenceService,
} from './onboarding-persistence';

export interface OnboardingData {
  caregiverName: string;
  babyName: string;
  babyBirthDate: string;
  consentGiven: boolean;
  consentAt: string | null;
}

type ProfileData = Pick<
  OnboardingData,
  | 'caregiverName'
  | 'babyName'
  | 'babyBirthDate'
>;

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly auth =
    inject(AuthService);

  private readonly persistence =
    inject(
      OnboardingPersistenceService,
    );

  private readonly emptyData:
    OnboardingData = {
      caregiverName: '',
      babyName: '',
      babyBirthDate: '',
      consentGiven: false,
      consentAt: null,
    };

  private readonly errorState =
    signal<string | null>(null);

  private readonly readyState =
    signal(false);

  private readonly loadingState =
    signal(false);

  private loadedUid:
    string | null = null;

  private loadingUid:
    string | null = null;

  private loadPromise:
    Promise<void> | null = null;

  readonly caregiverName =
    signal('');

  readonly babyName =
    signal('');

  readonly babyBirthDate =
    signal('');

  readonly consentGiven =
    signal(false);

  readonly consentAt =
    signal<string | null>(null);

  /*
   * Mantemos este nome temporariamente
   * para não quebrar os templates atuais.
   */
  readonly storageError =
    this.errorState.asReadonly();

  readonly isReady =
    this.readyState.asReadonly();

  readonly isLoading =
    this.loadingState.asReadonly();

  readonly isComplete =
    computed(
      () =>
        isValidName(
          this.caregiverName(),
        ) &&
        isValidName(
          this.babyName(),
        ) &&
        isValidBirthDate(
          this.babyBirthDate(),
        ) &&
        this.consentGiven(),
    );

  async ensureLoaded():
    Promise<void> {
    await this.auth
      .waitUntilReady();

    const uid =
      this.auth.user()?.uid ??
      null;

    if (uid === null) {
      this.loadedUid = null;
      this.loadingUid = null;

      this.applyData(
        this.emptyData,
      );

      this.readyState.set(true);
      this.loadingState.set(false);

      return;
    }

    if (
      this.loadedUid === uid &&
      this.readyState()
    ) {
      return;
    }

    if (
      this.loadPromise !== null &&
      this.loadingUid === uid
    ) {
      return this.loadPromise;
    }

    this.applyData(
      this.emptyData,
    );

    this.readyState.set(false);
    this.loadingState.set(true);
    this.errorState.set(null);

    this.loadingUid = uid;

    const promise =
      this.loadForUser(uid);

    this.loadPromise =
      promise;

    try {
      await promise;
    } finally {
      if (
        this.loadPromise ===
        promise
      ) {
        this.loadPromise = null;
        this.loadingUid = null;
        this.loadingState.set(false);
      }
    }
  }

  async setCaregiverName(
    name: string,
    consentGiven: boolean,
  ): Promise<boolean> {
    const normalizedName =
      name.trim();

    if (
      !isValidName(
        normalizedName,
      ) ||
      !consentGiven
    ) {
      return false;
    }

    await this.ensureLoaded();

    const data:
      OnboardingData = {
        ...this.currentData(),

        caregiverName:
          normalizedName,

        consentGiven: true,

        consentAt:
          this.consentAt() ??
          new Date()
            .toISOString(),
      };

    return this.saveData(
      data,
    );
  }

  async setBabyData(
    name: string,
    birthDate: string,
  ): Promise<boolean> {
    const normalizedName =
      name.trim();

    if (
      !isValidName(
        normalizedName,
      ) ||
      !isValidBirthDate(
        birthDate,
      )
    ) {
      return false;
    }

    await this.ensureLoaded();

    return this.saveData({
      ...this.currentData(),

      babyName:
        normalizedName,

      babyBirthDate:
        birthDate,
    });
  }

  async updateProfile(
    data: ProfileData,
  ): Promise<boolean> {
    if (
      !isValidName(
        data.caregiverName,
      ) ||
      !isValidName(
        data.babyName,
      ) ||
      !isValidBirthDate(
        data.babyBirthDate,
      )
    ) {
      return false;
    }

    await this.ensureLoaded();

    return this.saveData({
      ...this.currentData(),

      caregiverName:
        data.caregiverName
          .trim(),

      babyName:
        data.babyName
          .trim(),

      babyBirthDate:
        data.babyBirthDate,
    });
  }

  getIncompleteRoute():
    | '/onboarding/about-you'
    | '/onboarding/about-baby'
    | '/home' {
    if (
      !isValidName(
        this.caregiverName(),
      ) ||
      !this.consentGiven()
    ) {
      return '/onboarding/about-you';
    }

    if (
      !isValidName(
        this.babyName(),
      ) ||
      !isValidBirthDate(
        this.babyBirthDate(),
      )
    ) {
      return '/onboarding/about-baby';
    }

    return '/home';
  }

  private async loadForUser(
    uid: string,
  ): Promise<void> {
    try {
      const data =
        await this.persistence
          .load();

      /*
       * Evita aplicar os dados caso
       * o usuário tenha mudado durante
       * uma leitura assíncrona.
       */
      if (
        this.auth.user()?.uid !==
        uid
      ) {
        return;
      }

      this.applyData(
        data ??
        this.emptyData,
      );

      this.loadedUid = uid;
      this.readyState.set(true);
      this.errorState.set(null);
    } catch {
      if (
        this.auth.user()?.uid !==
        uid
      ) {
        return;
      }

      this.applyData(
        this.emptyData,
      );

      this.loadedUid = uid;
      this.readyState.set(true);

      this.errorState.set(
        'Não foi possível carregar seus dados da nuvem. Verifique sua conexão e tente novamente.',
      );
    }
  }

  private async saveData(
    data: OnboardingData,
  ): Promise<boolean> {
    const uid =
      this.auth.user()?.uid;

    if (!uid) {
      this.errorState.set(
        'É necessário estar conectado para salvar seus dados.',
      );

      return false;
    }

    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      await this.persistence
        .save(data);

      if (
        this.auth.user()?.uid !==
        uid
      ) {
        return false;
      }

      this.applyData(data);
      this.loadedUid = uid;

      return true;
    } catch {
      this.errorState.set(
        'Não foi possível salvar seus dados na nuvem. Verifique sua conexão e tente novamente.',
      );

      return false;
    } finally {
      this.loadingState.set(false);
    }
  }

  private currentData():
    OnboardingData {
    return {
      caregiverName:
        this.caregiverName(),

      babyName:
        this.babyName(),

      babyBirthDate:
        this.babyBirthDate(),

      consentGiven:
        this.consentGiven(),

      consentAt:
        this.consentAt(),
    };
  }

  private applyData(
    data: OnboardingData,
  ): void {
    this.caregiverName.set(
      data.caregiverName,
    );

    this.babyName.set(
      data.babyName,
    );

    this.babyBirthDate.set(
      data.babyBirthDate,
    );

    this.consentGiven.set(
      data.consentGiven,
    );

    this.consentAt.set(
      data.consentAt,
    );
  }
}