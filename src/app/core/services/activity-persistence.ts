import {
  Injectable,
  inject,
} from '@angular/core';

import type {
  Diaper,
  DiaperType,
} from '../models/diaper';

import type {
  Feeding,
  FeedingPeriod,
  FeedingSide,
} from '../models/feeding';

import type {
  Sleep,
} from '../models/sleep';

import {
  AuthService,
} from './auth';

import {
  UserDataRepository,
} from './user-data.repository';

export interface ActivitySnapshot {
  readonly feedings:
    readonly Feeding[];

  readonly sleeps:
    readonly Sleep[];

  readonly diapers:
    readonly Diaper[];
}

@Injectable({
  providedIn: 'root',
})
export class ActivityPersistenceService {
  private readonly auth =
    inject(AuthService);

  private readonly repository =
    inject(UserDataRepository);

  private readonly feedingKey =
    'nascemos-pais:feedings:v2';

  private readonly legacyFeedingKey =
    'nascemos-pais:feedings:v1';

  private readonly sleepKey =
    'nascemos-pais:sleeps:v1';

  private readonly diaperKey =
    'nascemos-pais:diapers:v1';

  private loadedUid:
    string | null = null;

  private snapshot:
    ActivitySnapshot | null = null;

  private loadingUid:
    string | null = null;

  private loadPromise:
    Promise<ActivitySnapshot> | null =
      null;

  async load():
    Promise<ActivitySnapshot> {
    await this.auth
      .waitUntilReady();

    const uid =
      this.auth.user()?.uid;

    if (!uid) {
      throw new Error(
        'Usuário não autenticado.',
      );
    }

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      return this.snapshot;
    }

    if (
      this.loadingUid === uid &&
      this.loadPromise !== null
    ) {
      return this.loadPromise;
    }

    this.loadedUid = null;
    this.snapshot = null;
    this.loadingUid = uid;

    const promise =
      this.loadForUser(uid);

    this.loadPromise = promise;

    try {
      const result =
        await promise;

      if (
        this.auth.user()?.uid !==
        uid
      ) {
        throw new Error(
          'A sessão mudou durante o carregamento.',
        );
      }

      this.loadedUid = uid;
      this.snapshot = result;

      return result;
    } finally {
      if (
        this.loadPromise ===
        promise
      ) {
        this.loadPromise = null;
        this.loadingUid = null;
      }
    }
  }

  async saveFeeding(
    feeding: Feeding,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.repository
      .saveRecord(
        'feedings',
        feeding,
      );

    this.assertSameUser(uid);

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      this.snapshot = {
        ...this.snapshot,

        feedings: [
          feeding,

          ...this.snapshot
            .feedings
            .filter(
              (item) =>
                item.id !==
                feeding.id,
            ),
        ].sort(
          (a, b) =>
            b.startedAt -
            a.startedAt,
        ),
      };
    }
  }

  async deleteFeeding(
    id: string,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.repository
      .deleteRecord(
        'feedings',
        id,
      );

    this.assertSameUser(uid);

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      this.snapshot = {
        ...this.snapshot,

        feedings:
          this.snapshot
            .feedings
            .filter(
              (feeding) =>
                feeding.id !== id,
            ),
      };
    }
  }

  async saveSleep(
    sleep: Sleep,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.repository
      .saveRecord(
        'sleeps',
        sleep,
      );

    this.assertSameUser(uid);

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      this.snapshot = {
        ...this.snapshot,

        sleeps: [
          sleep,

          ...this.snapshot
            .sleeps
            .filter(
              (item) =>
                item.id !==
                sleep.id,
            ),
        ].sort(
          (a, b) =>
            b.startedAt -
            a.startedAt,
        ),
      };
    }
  }

  async deleteSleep(
    id: string,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.repository
      .deleteRecord(
        'sleeps',
        id,
      );

    this.assertSameUser(uid);

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      this.snapshot = {
        ...this.snapshot,

        sleeps:
          this.snapshot
            .sleeps
            .filter(
              (sleep) =>
                sleep.id !== id,
            ),
      };
    }
  }

  async saveDiaper(
    diaper: Diaper,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.repository
      .saveRecord(
        'diapers',
        diaper,
      );

    this.assertSameUser(uid);

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      this.snapshot = {
        ...this.snapshot,

        diapers: [
          diaper,

          ...this.snapshot
            .diapers
            .filter(
              (item) =>
                item.id !==
                diaper.id,
            ),
        ].sort(
          (a, b) =>
            b.recordedAt -
            a.recordedAt,
        ),
      };
    }
  }

  async deleteDiaper(
    id: string,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.repository
      .deleteRecord(
        'diapers',
        id,
      );

    this.assertSameUser(uid);

    if (
      this.loadedUid === uid &&
      this.snapshot !== null
    ) {
      this.snapshot = {
        ...this.snapshot,

        diapers:
          this.snapshot
            .diapers
            .filter(
              (diaper) =>
                diaper.id !== id,
            ),
      };
    }
  }

  private async loadForUser(
    uid: string,
  ): Promise<ActivitySnapshot> {
    const profile =
      await this.repository
        .readProfile<
          Record<
            string,
            unknown
          >
        >();

    if (profile === null) {
      throw new Error(
        'Perfil do usuário não encontrado.',
      );
    }

    const [
      rawFeedings,
      rawSleeps,
      rawDiapers,
    ] = await Promise.all([
      this.repository
        .listRecords<Feeding>(
          'feedings',
        ),

      this.repository
        .listRecords<Sleep>(
          'sleeps',
        ),

      this.repository
        .listRecords<Diaper>(
          'diapers',
        ),
    ]);

    this.assertSameUser(uid);

    const cloud =
      this.normalizeSnapshot({
        feedings:
          rawFeedings,

        sleeps:
          rawSleeps,

        diapers:
          rawDiapers,
      });

    if (
      profile[
        'recordsMigrationVersion'
      ] === 1
    ) {
      this.removeLegacyData();

      return cloud;
    }

    const legacy =
      this.readLegacySnapshot();

    const merged =
      this.mergeSnapshots(
        cloud,
        legacy,
      );

    this.validateConsistency(
      merged,
    );

    /*
     * Os IDs originais são usados como
     * IDs dos documentos. Repetir uma
     * migração interrompida não cria
     * registros duplicados.
     */
    if (
      legacy.feedings.length > 0
    ) {
      await this.repository
        .saveRecords(
          'feedings',
          legacy.feedings,
        );
    }

    if (
      legacy.sleeps.length > 0
    ) {
      await this.repository
        .saveRecords(
          'sleeps',
          legacy.sleeps,
        );
    }

    if (
      legacy.diapers.length > 0
    ) {
      await this.repository
        .saveRecords(
          'diapers',
          legacy.diapers,
        );
    }

    this.assertSameUser(uid);

    /*
     * O marcador só é gravado depois
     * que todas as coleções foram
     * persistidas com sucesso.
     */
    await this.repository
      .saveProfile({
        recordsMigrationVersion:
          1,

        recordsMigratedAt:
          new Date()
            .toISOString(),
      });

    this.assertSameUser(uid);

    /*
     * O localStorage só é apagado
     * depois da confirmação completa
     * da migração.
     */
    this.removeLegacyData();

    return merged;
  }

  private readLegacySnapshot():
    ActivitySnapshot {
    const storage =
      this.getStorage();

    if (storage === null) {
      return {
        feedings: [],
        sleeps: [],
        diapers: [],
      };
    }

    const currentFeedings =
      storage.getItem(
        this.feedingKey,
      );

    const oldFeedings =
      storage.getItem(
        this.legacyFeedingKey,
      );

    const feedingSource =
      currentFeedings ??
      oldFeedings;

    return this.normalizeSnapshot({
      feedings:
        this.parseStoredArray(
          feedingSource,
          (value) =>
            this.parseFeeding(
              value,
              currentFeedings === null &&
                oldFeedings !== null,
            ),
        ),

      sleeps:
        this.parseStoredArray(
          storage.getItem(
            this.sleepKey,
          ),
          (value) =>
            this.parseSleep(value),
        ),

      diapers:
        this.parseStoredArray(
          storage.getItem(
            this.diaperKey,
          ),
          (value) =>
            this.parseDiaper(value),
        ),
    });
  }

  private parseStoredArray<T>(
    raw: string | null,
    parse: (value: unknown) => T,
  ): T[] {
    if (raw === null) {
      return [];
    }

    let value: unknown;

    try {
      value =
        JSON.parse(raw);
    } catch {
      throw new Error(
        'Os registros locais estão inválidos.',
      );
    }

    if (!Array.isArray(value)) {
      throw new Error(
        'Os registros locais estão inválidos.',
      );
    }

    return value.map(parse);
  }

  private normalizeSnapshot(
    value: {
      feedings:
        readonly unknown[];

      sleeps:
        readonly unknown[];

      diapers:
        readonly unknown[];
    },
  ): ActivitySnapshot {
    const snapshot:
      ActivitySnapshot = {
        feedings:
          value.feedings
            .map((item) =>
              this.parseFeeding(
                item,
                false,
              ),
            )
            .sort(
              (a, b) =>
                b.startedAt -
                a.startedAt,
            ),

        sleeps:
          value.sleeps
            .map((item) =>
              this.parseSleep(
                item,
              ),
            )
            .sort(
              (a, b) =>
                b.startedAt -
                a.startedAt,
            ),

        diapers:
          value.diapers
            .map((item) =>
              this.parseDiaper(
                item,
              ),
            )
            .sort(
              (a, b) =>
                b.recordedAt -
                a.recordedAt,
            ),
      };

    this.validateConsistency(
      snapshot,
    );

    return snapshot;
  }

  private mergeSnapshots(
    cloud: ActivitySnapshot,
    legacy: ActivitySnapshot,
  ): ActivitySnapshot {
    return this.normalizeSnapshot({
      feedings:
        this.mergeById(
          cloud.feedings,
          legacy.feedings,
        ),

      sleeps:
        this.mergeById(
          cloud.sleeps,
          legacy.sleeps,
        ),

      diapers:
        this.mergeById(
          cloud.diapers,
          legacy.diapers,
        ),
    });
  }

  private mergeById<
    T extends {
      readonly id: string;
    },
  >(
    cloud: readonly T[],
    legacy: readonly T[],
  ): T[] {
    const records =
      new Map<string, T>();

    for (const record of cloud) {
      records.set(
        record.id,
        record,
      );
    }

    /*
     * Durante uma migração ainda não
     * concluída, o registro local é o
     * que estamos tentando persistir.
     */
    for (const record of legacy) {
      records.set(
        record.id,
        record,
      );
    }

    return [
      ...records.values(),
    ];
  }

  private validateConsistency(
    snapshot: ActivitySnapshot,
  ): void {
    this.validateUniqueIds(
      snapshot.feedings,
    );

    this.validateUniqueIds(
      snapshot.sleeps,
    );

    this.validateUniqueIds(
      snapshot.diapers,
    );

    const activeFeedings =
      snapshot.feedings.filter(
        (feeding) =>
          feeding.endedAt ===
          null,
      ).length;

    const activeSleeps =
      snapshot.sleeps.filter(
        (sleep) =>
          sleep.endedAt === null,
      ).length;

    if (
      activeFeedings > 1 ||
      activeSleeps > 1
    ) {
      throw new Error(
        'Os registros possuem atividades simultâneas inconsistentes.',
      );
    }
  }

  private validateUniqueIds(
    records:
      readonly {
        readonly id: string;
      }[],
  ): void {
    const ids =
      new Set(
        records.map(
          (record) =>
            record.id,
        ),
      );

    if (
      ids.size !==
      records.length
    ) {
      throw new Error(
        'Existem registros duplicados.',
      );
    }
  }

  private parseFeeding(
    value: unknown,
    legacy: boolean,
  ): Feeding {
    if (!this.isObject(value)) {
      throw new Error(
        'Registro de mamada inválido.',
      );
    }

    const id =
      value['id'];

    const startedAt =
      value['startedAt'];

    const endedAt =
      value['endedAt'];

    const side =
      value['side'];

    if (
      typeof id !==
        'string' ||
      id.trim().length === 0 ||
      id.includes('/') ||
      !this.isTimestamp(
        startedAt,
      ) ||
      !(
        endedAt === null ||
        (
          this.isTimestamp(
            endedAt,
          ) &&
          endedAt >=
            startedAt
        )
      ) ||
      !this.isSide(side)
    ) {
      throw new Error(
        'Registro de mamada inválido.',
      );
    }

    const base = {
      id,
      startedAt,
      endedAt,
      side,
    };

    if (legacy) {
      return {
        ...base,
        periods: null,
      };
    }

    const rawPeriods =
      value['periods'];

    if (rawPeriods === null) {
      return {
        ...base,
        periods: null,
      };
    }

    if (
      !Array.isArray(
        rawPeriods,
      ) ||
      rawPeriods.length === 0
    ) {
      throw new Error(
        'Períodos de mamada inválidos.',
      );
    }

    const periods:
      FeedingPeriod[] = [];

    let previousEnd =
      startedAt;

    for (
      let index = 0;
      index < rawPeriods.length;
      index++
    ) {
      const raw =
        rawPeriods[index];

      if (!this.isObject(raw)) {
        throw new Error(
          'Período de mamada inválido.',
        );
      }

      const periodStart =
        raw['startedAt'];

      const periodEnd =
        raw['endedAt'];

      const periodSide =
        raw['side'];

      const isLast =
        index ===
        rawPeriods.length - 1;

      if (
        !this.isTimestamp(
          periodStart,
        ) ||
        periodStart <
          startedAt ||
        !this.isSide(
          periodSide,
        ) ||
        !(
          periodEnd === null ||
          (
            this.isTimestamp(
              periodEnd,
            ) &&
            periodEnd >=
              periodStart
          )
        )
      ) {
        throw new Error(
          'Período de mamada inválido.',
        );
      }

      if (
        index > 0 &&
        periodStart !==
          previousEnd
      ) {
        throw new Error(
          'Períodos de mamada descontínuos.',
        );
      }

      if (
        !isLast &&
        periodEnd === null
      ) {
        throw new Error(
          'Período de mamada aberto em posição inválida.',
        );
      }

      if (
        isLast &&
        (
          periodEnd !==
            endedAt ||
          periodSide !==
            side
        )
      ) {
        throw new Error(
          'Último período de mamada inconsistente.',
        );
      }

      periods.push({
        startedAt:
          periodStart,

        endedAt:
          periodEnd,

        side:
          periodSide,
      });

      previousEnd =
        periodEnd ??
        periodStart;
    }

    return {
      ...base,
      periods,
    };
  }

  private parseSleep(
    value: unknown,
  ): Sleep {
    if (!this.isObject(value)) {
      throw new Error(
        'Registro de sono inválido.',
      );
    }

    const id =
      value['id'];

    const startedAt =
      value['startedAt'];

    const endedAt =
      value['endedAt'];

    if (
      typeof id !==
        'string' ||
      id.trim().length === 0 ||
      id.includes('/') ||
      !this.isTimestamp(
        startedAt,
      ) ||
      !(
        endedAt === null ||
        (
          this.isTimestamp(
            endedAt,
          ) &&
          endedAt >=
            startedAt
        )
      )
    ) {
      throw new Error(
        'Registro de sono inválido.',
      );
    }

    return {
      id,
      startedAt,
      endedAt,
    };
  }

  private parseDiaper(
    value: unknown,
  ): Diaper {
    if (!this.isObject(value)) {
      throw new Error(
        'Registro de fralda inválido.',
      );
    }

    const id =
      value['id'];

    const type =
      value['type'];

    const recordedAt =
      value['recordedAt'];

    if (
      typeof id !==
        'string' ||
      id.trim().length === 0 ||
      id.includes('/') ||
      !this.isDiaperType(
        type,
      ) ||
      !this.isTimestamp(
        recordedAt,
      )
    ) {
      throw new Error(
        'Registro de fralda inválido.',
      );
    }

    return {
      id,
      type,
      recordedAt,
    };
  }

  private isObject(
    value: unknown,
  ): value is Record<
    string,
    unknown
  > {
    return (
      typeof value ===
        'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  private isTimestamp(
    value: unknown,
  ): value is number {
    return (
      typeof value ===
        'number' &&
      Number.isSafeInteger(
        value,
      ) &&
      value >= 0 &&
      value <=
        8_640_000_000_000_000
    );
  }

  private isSide(
    value: unknown,
  ): value is
    FeedingSide | null {
    return (
      value === null ||
      value === 'left' ||
      value === 'right'
    );
  }

  private isDiaperType(
    value: unknown,
  ): value is DiaperType {
    return (
      value === 'wet' ||
      value === 'dirty' ||
      value === 'both'
    );
  }

  private removeLegacyData():
    void {
    const storage =
      this.getStorage();

    if (storage === null) {
      return;
    }

    try {
      storage.removeItem(
        this.feedingKey,
      );

      storage.removeItem(
        this.legacyFeedingKey,
      );

      storage.removeItem(
        this.sleepKey,
      );

      storage.removeItem(
        this.diaperKey,
      );
    } catch {
      /*
       * A nuvem já é a fonte de verdade.
       * Uma falha de limpeza local não deve
       * invalidar a migração confirmada.
       */
    }
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
      this.auth.user()?.uid !==
      uid
    ) {
      throw new Error(
        'A sessão mudou durante a sincronização.',
      );
    }
  }
}