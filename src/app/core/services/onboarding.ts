import {
  Injectable,
  computed,
  signal,
} from '@angular/core';

export interface OnboardingData {
  caregiverName: string;
  babyName: string;
  babyBirthDate: string;
}

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

  readonly storageError =
    this.storageErrorState.asReadonly();

  readonly isComplete = computed(
    () =>
      this.isValidName(this.caregiverName()) &&
      this.isValidName(this.babyName()) &&
      this.isValidBirthDate(this.babyBirthDate()),
  );

  setCaregiverName(name: string): boolean {
    const normalizedName = name.trim();

    if (!this.isValidName(normalizedName)) {
      return false;
    }

    this.caregiverName.set(normalizedName);

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

  getIncompleteRoute():
    | '/onboarding/about-you'
    | '/onboarding/about-baby'
    | '/home' {
    if (!this.isValidName(this.caregiverName())) {
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

      const parsed: unknown = JSON.parse(savedData);

      if (!this.isStoredData(parsed)) {
        throw new Error('Dados inválidos.');
      }

      return {
        caregiverName: parsed.caregiverName.trim(),
        babyName: parsed.babyName.trim(),
        babyBirthDate: parsed.babyBirthDate,
      };
    } catch {
      this.setStorageError(
        'O cadastro salvo estava inválido e foi reiniciado. Preencha os dados novamente.',
      );

      return this.emptyData;
    }
  }

  private isStoredData(
    value: unknown,
  ): value is OnboardingData {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return false;
    }

    const data = value as Record<string, unknown>;
    const allowedKeys = new Set([
      'caregiverName',
      'babyName',
      'babyBirthDate',
    ]);

    if (
      Object.keys(data).some(
        (key) => !allowedKeys.has(key),
      )
    ) {
      return false;
    }

    const caregiverName = data['caregiverName'];
    const babyName = data['babyName'];
    const babyBirthDate = data['babyBirthDate'];

    return (
      typeof caregiverName === 'string' &&
      typeof babyName === 'string' &&
      typeof babyBirthDate === 'string' &&
      (caregiverName.trim().length === 0 ||
        this.isValidName(caregiverName)) &&
      (babyName.trim().length === 0 ||
        this.isValidName(babyName)) &&
      (babyBirthDate === '' ||
        this.isValidBirthDate(babyBirthDate))
    );
  }

  private isValidName(value: string): boolean {
    return value.trim().length > 0;
  }

  private isValidBirthDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value
      .split('-')
      .map(Number);

    const date = new Date(
      year,
      month - 1,
      day,
    );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date.getTime() <= today.getTime();
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