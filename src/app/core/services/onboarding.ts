import {
  Injectable,
  computed,
  signal,
} from '@angular/core';

import {
  isValidName,
  isValidBirthDate,
} from '../validators/onboarding.validators';

export interface OnboardingData {
  caregiverName: string;
  babyName: string;
  babyBirthDate: string;
  consentGiven: boolean;
  consentAt: string | null;
}

type ProfileData = Pick<
  OnboardingData,
  'caregiverName' | 'babyName' | 'babyBirthDate'
>;

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly storageKey =
    'nascemos-pais:onboarding';

  private readonly emptyData: OnboardingData = {
    caregiverName: '',
    babyName: '',
    babyBirthDate: '',
    consentGiven: false,
    consentAt: null,
  };

  private readonly storageErrorState =
    signal<string | null>(null);

  private canWriteToStorage = true;

  private readonly initialData = this.loadData();

  readonly caregiverName = signal(
    this.initialData.caregiverName,
  );

  readonly babyName = signal(
    this.initialData.babyName,
  );

  readonly babyBirthDate = signal(
    this.initialData.babyBirthDate,
  );

  readonly consentGiven = signal(
    this.initialData.consentGiven,
  );

  readonly consentAt = signal(
    this.initialData.consentAt,
  );

  readonly storageError =
    this.storageErrorState.asReadonly();

  readonly isComplete = computed(
    () =>
      this.isValidName(this.caregiverName()) &&
      this.isValidName(this.babyName()) &&
      this.isValidBirthDate(this.babyBirthDate()) &&
      this.consentGiven(),
  );

  setCaregiverName(
    name: string,
    consentGiven: boolean,
  ): boolean {
    const normalizedName = name.trim();

    if (
      !this.isValidName(normalizedName) ||
      !consentGiven
    ) {
      return false;
    }

    this.caregiverName.set(normalizedName);
    this.consentGiven.set(true);

    if (!this.consentAt()) {
      this.consentAt.set(new Date().toISOString());
    }

    return this.saveData();
  }

  setBabyData(
    name: string,
    birthDate: string,
  ): boolean {
    const normalizedName = name.trim();

    if (
      !this.isValidName(normalizedName) ||
      !this.isValidBirthDate(birthDate)
    ) {
      return false;
    }

    this.babyName.set(normalizedName);
    this.babyBirthDate.set(birthDate);

    return this.saveData();
  }

  updateProfile(data: ProfileData): boolean {
    if (
      !isValidName(data.caregiverName) ||
      !isValidName(data.babyName) ||
      !isValidBirthDate(data.babyBirthDate)
    ) {
      return false;
    }

    this.caregiverName.set(
      data.caregiverName.trim(),
    );

    this.babyName.set(
      data.babyName.trim(),
    );

    this.babyBirthDate.set(
      data.babyBirthDate,
    );

    return this.saveData();
  }

  getIncompleteRoute():
    | '/onboarding/about-you'
    | '/onboarding/about-baby'
    | '/home' {
    if (
      !this.isValidName(this.caregiverName()) ||
      !this.consentGiven()
    ) {
      return '/onboarding/about-you';
    }

    if (
      !this.isValidName(this.babyName()) ||
      !this.isValidBirthDate(this.babyBirthDate())
    ) {
      return '/onboarding/about-baby';
    }

    return '/home';
  }

  private saveData(): boolean {
    if (!this.canWriteToStorage) {
      return false;
    }

    const storage = this.getStorage();

    if (storage === null) {
      this.setStorageError(
        'Não foi possível acessar o armazenamento deste navegador. Os dados ficarão apenas nesta sessão.',
        true,
      );

      return false;
    }

    const data: OnboardingData = {
      caregiverName: this.caregiverName(),
      babyName: this.babyName(),
      babyBirthDate: this.babyBirthDate(),
      consentGiven: this.consentGiven(),
      consentAt: this.consentAt(),
    };

    try {
      storage.setItem(
        this.storageKey,
        JSON.stringify(data),
      );

      this.storageErrorState.set(null);

      return true;
    } catch {
      this.setStorageError(
        'Não foi possível salvar o cadastro. Os dados ficarão apenas nesta sessão.',
      );

      return false;
    }
  }

  private loadData(): OnboardingData {
    const storage = this.getStorage();

    if (storage === null) {
      this.setStorageError(
        'Não foi possível acessar o cadastro salvo neste navegador.',
        true,
      );

      return this.emptyData;
    }

    try {
      const savedData = storage.getItem(
        this.storageKey,
      );

      if (savedData === null) {
        return this.emptyData;
      }

      const parsed: unknown =
        JSON.parse(savedData);

      const normalizedData =
        this.normalizeStoredData(parsed);

      if (normalizedData === null) {
        throw new Error('Dados inválidos.');
      }

      return normalizedData;
    } catch {
      this.setStorageError(
        'O cadastro salvo estava inválido e foi reiniciado. Preencha os dados novamente.',
      );

      return this.emptyData;
    }
  }

  private normalizeStoredData(
    value: unknown,
  ): OnboardingData | null {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }

    const data =
      value as Record<string, unknown>;

    const allowedKeys = new Set([
      'caregiverName',
      'babyName',
      'babyBirthDate',
      'consentGiven',
      'consentAt',
    ]);

    if (
      Object.keys(data).some(
        (key) => !allowedKeys.has(key),
      )
    ) {
      return null;
    }

    const caregiverName =
      data['caregiverName'];

    const babyName =
      data['babyName'];

    const babyBirthDate =
      data['babyBirthDate'];

    const consentGiven =
      data['consentGiven'];

    const consentAt =
      data['consentAt'];

    if (
      typeof caregiverName !== 'string' ||
      typeof babyName !== 'string' ||
      typeof babyBirthDate !== 'string'
    ) {
      return null;
    }

    if (
      caregiverName.trim().length > 0 &&
      !this.isValidName(caregiverName)
    ) {
      return null;
    }

    if (
      babyName.trim().length > 0 &&
      !this.isValidName(babyName)
    ) {
      return null;
    }

    if (
      babyBirthDate !== '' &&
      !this.isValidBirthDate(babyBirthDate)
    ) {
      return null;
    }

    /*
     * Compatibilidade com cadastros criados
     * antes da implementação do consentimento.
     */
    if (
      consentGiven === undefined &&
      consentAt === undefined
    ) {
      return {
        caregiverName:
          caregiverName.trim(),
        babyName:
          babyName.trim(),
        babyBirthDate,
        consentGiven: false,
        consentAt: null,
      };
    }

    if (
      typeof consentGiven !== 'boolean'
    ) {
      return null;
    }

    if (
      consentGiven &&
      !this.isValidConsentDate(consentAt)
    ) {
      return null;
    }

    if (
      !consentGiven &&
      consentAt !== null
    ) {
      return null;
    }

    return {
      caregiverName:
        caregiverName.trim(),
      babyName:
        babyName.trim(),
      babyBirthDate,
      consentGiven,
      consentAt:
        consentGiven
          ? (consentAt as string)
          : null,
    };
  }

  private isValidConsentDate(
    value: unknown,
  ): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      !Number.isNaN(Date.parse(value))
    );
  }

  private isValidName(
    value: string,
  ): boolean {
    return isValidName(value);
  }

  private isValidBirthDate(
    value: string,
  ): boolean {
    return isValidBirthDate(value);
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private setStorageError(
    message: string,
    disableWrites = false,
  ): void {
    if (disableWrites) {
      this.canWriteToStorage = false;
    }

    this.storageErrorState.set(message);
  }
}