import {
  Injectable,
  inject,
} from '@angular/core';

import type {
  Diaper,
} from '../models/diaper';

import type {
  Feeding,
} from '../models/feeding';

import type {
  Sleep,
} from '../models/sleep';

import {
  AuthService,
} from './auth';

import {
  BabyDataRepository,
} from './baby-data.repository';

import {
  UserDataRepository,
} from './user-data.repository';

@Injectable({
  providedIn: 'root',
})
export class BabyMigrationService {
  private readonly auth =
    inject(AuthService);

  private readonly users =
    inject(
      UserDataRepository,
    );

  private readonly babies =
    inject(
      BabyDataRepository,
    );

  async ensureMigrated():
    Promise<string | null> {
    await this.auth
      .waitUntilReady();

    const uid =
      this.requireUid();

    const profile =
      await this.users
        .readProfile<
          Record<
            string,
            unknown
          >
        >();

    this.assertSameUser(
      uid,
    );

    if (profile === null) {
      return null;
    }

    const activeBabyId =
      this.readActiveBabyId(
        profile,
      );

    if (
      profile[
      'babyMigrationVersion'
      ] === 1
    ) {
      if (
        activeBabyId ===
        null
      ) {
        throw new Error(
          'A migração do bebê está inconsistente.',
        );
      }

      await this
        .assertBabyAccess(
          activeBabyId,
          uid,
          false,
        );

      return activeBabyId;
    }

    const rawBabyName =
      profile['babyName'];

    const rawBirthDate =
      profile[
      'babyBirthDate'
      ];

    if (
      !this.isValidName(
        rawBabyName,
      ) ||
      !this.isValidBirthDate(
        rawBirthDate,
      )
    ) {
      throw new Error(
        'Os dados atuais do bebê não permitem a migração.',
      );
    }

    let babyId =
      activeBabyId;

    if (babyId === null) {
      const baby =
        await this.babies
          .createOwnedBaby({
            name:
              rawBabyName
                .trim(),

            birthDate:
              rawBirthDate,
          });

      this.assertSameUser(
        uid,
      );

      babyId =
        baby.id;
    } else {
      /*
       * activeBabyId sem versão 1 significa
       * que uma migração anterior começou,
       * mas não chegou ao fim.
       *
       * Reutilizamos o mesmo bebê em vez
       * de criar outro.
       */
      await this
        .assertBabyAccess(
          babyId,
          uid,
          true,
        );
    }

    const [
      feedings,
      sleeps,
      diapers,
    ] =
      await Promise.all([
        this.users
          .listRecords<Feeding>(
            'feedings',
          ),

        this.users
          .listRecords<Sleep>(
            'sleeps',
          ),

        this.users
          .listRecords<Diaper>(
            'diapers',
          ),
      ]);

    this.assertSameUser(
      uid,
    );

    await this.babies
      .saveRecords(
        babyId,
        'feedings',
        feedings,
      );

    await this.babies
      .saveRecords(
        babyId,
        'sleeps',
        sleeps,
      );

    await this.babies
      .saveRecords(
        babyId,
        'diapers',
        diapers,
      );

    this.assertSameUser(
      uid,
    );

    /*
     * Não basta confiar no retorno das
     * gravações. Lemos novamente a nuvem
     * e confirmamos que todos os IDs
     * antigos existem no bebê.
     */
    const [
      migratedFeedings,
      migratedSleeps,
      migratedDiapers,
    ] =
      await Promise.all([
        this.babies
          .listRecords<Feeding>(
            babyId,
            'feedings',
          ),

        this.babies
          .listRecords<Sleep>(
            babyId,
            'sleeps',
          ),

        this.babies
          .listRecords<Diaper>(
            babyId,
            'diapers',
          ),
      ]);

    this.assertSameUser(
      uid,
    );

    this.assertCopied(
      feedings,
      migratedFeedings,
    );

    this.assertCopied(
      sleeps,
      migratedSleeps,
    );

    this.assertCopied(
      diapers,
      migratedDiapers,
    );

    /*
     * Somente depois da confirmação
     * completa marcamos a migração
     * como concluída.
     *
     * Os registros antigos continuam
     * intactos por enquanto.
     */
    await this.users
      .saveProfile({
        activeBabyId:
          babyId,

        babyMigrationVersion:
          1,

        babyMigratedAt:
          new Date()
            .toISOString(),
      });

    this.assertSameUser(
      uid,
    );

    return babyId;
  }

  private async assertBabyAccess(
    babyId: string,
    uid: string,
    requireOwner: boolean,
  ): Promise<void> {
    const baby =
      await this.babies
        .readBaby(
          babyId,
        );

    this.assertSameUser(
      uid,
    );

    const membership =
      await this.babies
        .readMembership(
          babyId,
        );

    this.assertSameUser(
      uid,
    );

    if (
      baby === null ||
      membership === null
    ) {
      throw new Error(
        'A migração do bebê está inconsistente.',
      );
    }

    if (
      requireOwner &&
      (
        baby.createdByUid !==
        uid ||
        membership.role !==
        'owner'
      )
    ) {
      throw new Error(
        'A migração do bebê está inconsistente.',
      );
    }
  }

  private readActiveBabyId(
    profile:
      Record<
        string,
        unknown
      >,
  ): string | null {
    const value =
      profile[
      'activeBabyId'
      ];

    if (
      value ===
      undefined ||
      value === null
    ) {
      return null;
    }

    if (
      typeof value !==
      'string' ||
      value.trim()
        .length === 0 ||
      value.includes('/')
    ) {
      throw new Error(
        'A referência do bebê é inválida.',
      );
    }

    return value;
  }

  private assertCopied(
    source:
      readonly {
        readonly id:
        string;
      }[],
    target:
      readonly {
        readonly id:
        string;
      }[],
  ): void {
    const targetIds =
      new Set(
        target.map(
          (record) =>
            record.id,
        ),
      );

    const missing =
      source.some(
        (record) =>
          !targetIds.has(
            record.id,
          ),
      );

    if (missing) {
      throw new Error(
        'A migração dos registros do bebê não foi confirmada.',
      );
    }
  }

  private isValidName(
    value: unknown,
  ): value is string {
    return (
      typeof value ===
      'string' &&
      value.trim()
        .length >= 1 &&
      value.trim()
        .length <= 80
    );
  }

  private isValidBirthDate(
    value: unknown,
  ): value is string {
    if (
      typeof value !==
      'string' ||
      !/^\d{4}-\d{2}-\d{2}$/
        .test(value)
    ) {
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

  private requireUid():
    string {
    const uid =
      this.auth.user()?.uid;

    if (!uid) {
      throw new Error(
        'Usuário não autenticado.',
      );
    }

    return uid;
  }

  private assertSameUser(
    uid: string,
  ): void {
    if (
      this.auth
        .user()?.uid !==
      uid
    ) {
      throw new Error(
        'A sessão mudou durante a migração do bebê.',
      );
    }
  }
}