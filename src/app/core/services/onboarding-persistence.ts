import {
  Injectable,
  inject,
} from '@angular/core';

import {
  OnboardingData,
} from './onboarding';

import {
  UserDataRepository,
} from './user-data.repository';

type OnboardingProfileDocument =
  OnboardingData & {
    createdAt?: string;
    updatedAt?: string;
    legacyMigrationVersion?: number;
  };

@Injectable({
  providedIn: 'root',
})
export class OnboardingPersistenceService {
  private readonly repository =
    inject(UserDataRepository);

  private readonly legacyStorageKey =
    'nascemos-pais:onboarding';

  private profileExists = false;

  async load():
    Promise<OnboardingData | null> {
    const cloud =
      await this.repository
        .readProfile<OnboardingProfileDocument>();

    if (cloud !== null) {
      const normalized =
        this.normalizeData(cloud);

      if (normalized === null) {
        throw new Error(
          'O perfil salvo no Firestore é inválido.',
        );
      }

      this.profileExists = true;

      return normalized;
    }

    this.profileExists = false;

    const legacy =
      this.readLegacyData();

    if (legacy === null) {
      return null;
    }

    const now =
      new Date().toISOString();

    await this.repository.saveProfile({
      ...legacy,

      createdAt: now,
      updatedAt: now,

      legacyMigrationVersion: 1,
    });

    /*
     * Só removemos os dados antigos depois
     * que o Firestore confirmou a gravação.
     */
    this.removeLegacyData();

    this.profileExists = true;

    return legacy;
  }

  async save(
    data: OnboardingData,
  ): Promise<void> {
    const normalized =
      this.normalizeData(data);

    if (normalized === null) {
      throw new Error(
        'Dados de onboarding inválidos.',
      );
    }

    const now =
      new Date().toISOString();

    await this.repository.saveProfile({
      ...normalized,

      ...(
        this.profileExists
          ? {}
          : {
              createdAt: now,
            }
      ),

      updatedAt: now,
    });

    this.profileExists = true;
  }

  private readLegacyData():
    OnboardingData | null {
    const storage =
      this.getStorage();

    if (storage === null) {
      return null;
    }

    const raw =
      storage.getItem(
        this.legacyStorageKey,
      );

    if (raw === null) {
      return null;
    }

    try {
      const parsed: unknown =
        JSON.parse(raw);

      return this.normalizeData(
        parsed,
        true,
      );
    } catch {
      return null;
    }
  }

  private removeLegacyData(): void {
    const storage =
      this.getStorage();

    if (storage === null) {
      return;
    }

    try {
      storage.removeItem(
        this.legacyStorageKey,
      );
    } catch {
      /*
       * O Firestore já confirmou a gravação.
       * Se a limpeza local falhar, uma futura
       * leitura continuará priorizando a nuvem.
       */
    }
  }

  private normalizeData(
    value: unknown,
    allowLegacy = false,
  ): OnboardingData | null {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }

    const data =
      value as Record<
        string,
        unknown
      >;

    const caregiverName =
      data['caregiverName'];

    const babyName =
      data['babyName'];

    const babyBirthDate =
      data['babyBirthDate'];

    let consentGiven =
      data['consentGiven'];

    let consentAt =
      data['consentAt'];

    if (
      typeof caregiverName !==
        'string' ||
      typeof babyName !==
        'string' ||
      typeof babyBirthDate !==
        'string'
    ) {
      return null;
    }

    /*
     * Dados criados antes da implementação
     * do consentimento LGPD.
     */
    if (
      allowLegacy &&
      consentGiven === undefined &&
      consentAt === undefined
    ) {
      consentGiven = false;
      consentAt = null;
    }

    if (
      typeof consentGiven !==
        'boolean'
    ) {
      return null;
    }

    if (
      !this.isValidNameOrEmpty(
        caregiverName,
      ) ||
      !this.isValidNameOrEmpty(
        babyName,
      ) ||
      !this.isValidBirthDateOrEmpty(
        babyBirthDate,
      )
    ) {
      return null;
    }

    if (consentGiven) {
      if (
        typeof consentAt !==
          'string' ||
        consentAt.length === 0 ||
        Number.isNaN(
          Date.parse(consentAt),
        )
      ) {
        return null;
      }
    } else if (
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
          ? consentAt as string
          : null,
    };
  }

  private isValidNameOrEmpty(
    value: string,
  ): boolean {
    const normalized =
      value.trim();

    return (
      normalized === '' ||
      (
        normalized.length >= 1 &&
        normalized.length <= 80
      )
    );
  }

  private isValidBirthDateOrEmpty(
    value: string,
  ): boolean {
    if (value === '') {
      return true;
    }

    const match =
      /^\d{4}-\d{2}-\d{2}$/
        .test(value);

    if (!match) {
      return false;
    }

    const date =
      new Date(
        `${value}T00:00:00`,
      );

    return (
      !Number.isNaN(
        date.getTime(),
      ) &&
      date.getTime() <=
        Date.now()
    );
  }

  private getStorage():
    Storage | null {
    if (
      typeof window ===
        'undefined'
    ) {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
}