import { Injectable, computed, inject, signal } from '@angular/core';
import type { Diaper, DiaperType } from '../models/diaper';
import type { Feeding, FeedingPeriod, FeedingSide } from '../models/feeding';
import type { Sleep } from '../models/sleep';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';
import { BabyDataRepository } from './baby-data.repository';
import { UserDataRepository } from './user-data.repository';

export interface ActivitySnapshot {
  readonly feedings: readonly Feeding[];
  readonly sleeps: readonly Sleep[];
  readonly diapers: readonly Diaper[];
}

interface ActivityState {
  readonly uid: string | null;
  readonly babyId: string | null;
  readonly snapshot: ActivitySnapshot;
  readonly ready: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

interface ActivityLoadResult {
  readonly babyId: string;
  readonly snapshot: ActivitySnapshot;
}

const EMPTY_SNAPSHOT: ActivitySnapshot = {
  feedings: [],
  sleeps: [],
  diapers: [],
};

@Injectable({
  providedIn: 'root',
})
export class ActivityPersistenceService {
  private readonly auth = inject(AuthService);
  private readonly babyContext = inject(BabyContextService);
  private readonly babies = inject(BabyDataRepository);

  /*
   * O repositório de usuário continua
   * existindo temporariamente apenas
   * para finalizar a migração dos
   * registros antigos.
   */
  private readonly repository = inject(UserDataRepository);

  private readonly feedingKey = 'nascemos-pais:feedings:v2';
  private readonly legacyFeedingKey = 'nascemos-pais:feedings:v1';
  private readonly sleepKey = 'nascemos-pais:sleeps:v1';
  private readonly diaperKey = 'nascemos-pais:diapers:v1';

  private readonly state = signal<ActivityState>({
    uid: null,
    babyId: null,
    snapshot: EMPTY_SNAPSHOT,
    ready: false,
    loading: false,
    error: null,
  });

  private loadingUid: string | null = null;
  private loadPromise: Promise<ActivityLoadResult> | null = null;

  readonly snapshot = computed<ActivitySnapshot>(() => {
    const uid = this.auth.user()?.uid ?? null;
    const babyId = this.babyContext.activeBabyId();
    const state = this.state();

    if (uid === null || babyId === null || state.uid !== uid || state.babyId !== babyId) {
      return EMPTY_SNAPSHOT;
    }

    return state.snapshot;
  });

  readonly feedings = computed(() => this.snapshot().feedings);
  readonly sleeps = computed(() => this.snapshot().sleeps);
  readonly diapers = computed(() => this.snapshot().diapers);

  readonly isReady = computed(() => {
    const uid = this.auth.user()?.uid ?? null;
    const babyId = this.babyContext.activeBabyId();
    const state = this.state();

    return (
      uid !== null && babyId !== null && state.uid === uid && state.babyId === babyId && state.ready
    );
  });

  readonly isLoading = computed(() => {
    const uid = this.auth.user()?.uid ?? null;
    const state = this.state();

    return uid !== null && state.uid === uid && state.loading;
  });

  readonly error = computed(() => {
    const uid = this.auth.user()?.uid ?? null;
    const babyId = this.babyContext.activeBabyId();
    const state = this.state();

    if (uid === null || state.uid !== uid) {
      return null;
    }

    if (state.babyId !== null && state.babyId !== babyId) {
      return null;
    }

    return state.error;
  });

  async load(): Promise<ActivitySnapshot> {
    await this.auth.waitUntilReady();

    const uid = this.auth.user()?.uid;

    if (!uid) {
      this.state.set({
        uid: null,
        babyId: null,
        snapshot: EMPTY_SNAPSHOT,
        ready: false,
        loading: false,
        error: null,
      });

      throw new Error('Usuário não autenticado.');
    }

    const activeBabyId = this.babyContext.activeBabyId();
    const current = this.state();

    if (
      activeBabyId !== null &&
      current.uid === uid &&
      current.babyId === activeBabyId &&
      current.ready
    ) {
      return current.snapshot;
    }

    if (this.loadingUid === uid && this.loadPromise !== null) {
      const result = await this.loadPromise;

      return result.snapshot;
    }

    this.state.set({
      uid,
      babyId: null,
      snapshot: EMPTY_SNAPSHOT,
      ready: false,
      loading: true,
      error: null,
    });

    this.loadingUid = uid;

    const promise = this.loadForUser(uid);

    this.loadPromise = promise;

    try {
      const result = await promise;

      this.assertSameContext(uid, result.babyId);

      this.state.set({
        uid,
        babyId: result.babyId,
        snapshot: result.snapshot,
        ready: true,
        loading: false,
        error: null,
      });

      return result.snapshot;
    } catch (error) {
      if (this.auth.user()?.uid === uid) {
        this.state.set({
          uid,
          babyId: null,
          snapshot: EMPTY_SNAPSHOT,
          ready: false,
          loading: false,
          error: this.loadErrorMessage(error),
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

  async saveFeeding(feeding: Feeding): Promise<void> {
    const { uid, babyId, snapshot } = this.requireReadyState();

    this.clearError(uid, babyId);

    try {
      await this.babies.saveRecord(babyId, 'feedings', feeding);

      this.assertSameContext(uid, babyId);

      this.updateSnapshot(uid, babyId, {
        ...snapshot,
        feedings: this.upsertFeeding(snapshot.feedings, feeding),
      });
    } catch (error) {
      this.setSyncError(uid, babyId);

      throw error;
    }
  }

  async deleteFeeding(id: string): Promise<void> {
    const { uid, babyId, snapshot } = this.requireReadyState();

    this.clearError(uid, babyId);

    try {
      await this.babies.deleteRecord(babyId, 'feedings', id);

      this.assertSameContext(uid, babyId);

      this.updateSnapshot(uid, babyId, {
        ...snapshot,
        feedings: snapshot.feedings.filter((feeding) => feeding.id !== id),
      });
    } catch (error) {
      this.setSyncError(uid, babyId);

      throw error;
    }
  }

  async saveSleep(sleep: Sleep): Promise<void> {
    const { uid, babyId, snapshot } = this.requireReadyState();

    this.clearError(uid, babyId);

    try {
      await this.babies.saveRecord(babyId, 'sleeps', sleep);

      this.assertSameContext(uid, babyId);

      this.updateSnapshot(uid, babyId, {
        ...snapshot,
        sleeps: this.upsertSleep(snapshot.sleeps, sleep),
      });
    } catch (error) {
      this.setSyncError(uid, babyId);

      throw error;
    }
  }

  async deleteSleep(id: string): Promise<void> {
    const { uid, babyId, snapshot } = this.requireReadyState();

    this.clearError(uid, babyId);

    try {
      await this.babies.deleteRecord(babyId, 'sleeps', id);

      this.assertSameContext(uid, babyId);

      this.updateSnapshot(uid, babyId, {
        ...snapshot,
        sleeps: snapshot.sleeps.filter((sleep) => sleep.id !== id),
      });
    } catch (error) {
      this.setSyncError(uid, babyId);

      throw error;
    }
  }

  async saveDiaper(diaper: Diaper): Promise<void> {
    const { uid, babyId, snapshot } = this.requireReadyState();

    this.clearError(uid, babyId);

    try {
      await this.babies.saveRecord(babyId, 'diapers', diaper);

      this.assertSameContext(uid, babyId);

      this.updateSnapshot(uid, babyId, {
        ...snapshot,
        diapers: this.upsertDiaper(snapshot.diapers, diaper),
      });
    } catch (error) {
      this.setSyncError(uid, babyId);

      throw error;
    }
  }

  async deleteDiaper(id: string): Promise<void> {
    const { uid, babyId, snapshot } = this.requireReadyState();

    this.clearError(uid, babyId);

    try {
      await this.babies.deleteRecord(babyId, 'diapers', id);

      this.assertSameContext(uid, babyId);

      this.updateSnapshot(uid, babyId, {
        ...snapshot,
        diapers: snapshot.diapers.filter((diaper) => diaper.id !== id),
      });
    } catch (error) {
      this.setSyncError(uid, babyId);

      throw error;
    }
  }

  clearSyncError(): void {
    const uid = this.auth.user()?.uid;
    const babyId = this.babyContext.activeBabyId();

    if (!uid || !babyId) {
      return;
    }

    this.clearError(uid, babyId);
  }

  private async loadForUser(uid: string): Promise<ActivityLoadResult> {
    /*
     * Primeiro finalizamos a migração
     * antiga do localStorage para
     * users/{uid}.
     *
     * Depois BabyMigrationService pode
     * copiar o conjunto completo para
     * babies/{babyId}.
     */
    await this.ensureLegacyRecordsMigrated(uid);

    this.assertSameUser(uid);

    await this.babyContext.ensureLoaded();

    this.assertSameUser(uid);

    const babyId = this.requireActiveBabyId();

    this.assertSameContext(uid, babyId);

    const [rawFeedings, rawSleeps, rawDiapers] = await Promise.all([
      this.babies.listRecords<Feeding>(babyId, 'feedings'),
      this.babies.listRecords<Sleep>(babyId, 'sleeps'),
      this.babies.listRecords<Diaper>(babyId, 'diapers'),
    ]);

    this.assertSameContext(uid, babyId);

    return {
      babyId,
      /*
       * Registros compartilhados antigos podem ter
       * sido criados antes do bloqueio atômico.
       *
       * Eles continuam carregáveis para que os pais
       * consigam encerrá-los ou removê-los pela UI.
       */
      snapshot: this.normalizeSnapshot(
        {
          feedings: rawFeedings,
          sleeps: rawSleeps,
          diapers: rawDiapers,
        },
        true,
      ),
    };
  }

  private async ensureLegacyRecordsMigrated(uid: string): Promise<void> {
    const profile = await this.repository.readProfile<Record<string, unknown>>();

    this.assertSameUser(uid);

    if (profile === null) {
      throw new Error('Perfil do usuário não encontrado.');
    }

    if (profile['recordsMigrationVersion'] === 1) {
      this.removeLegacyData();

      return;
    }

    const [rawFeedings, rawSleeps, rawDiapers] = await Promise.all([
      this.repository.listRecords<Feeding>('feedings'),
      this.repository.listRecords<Sleep>('sleeps'),
      this.repository.listRecords<Diaper>('diapers'),
    ]);

    this.assertSameUser(uid);

    const cloud = this.normalizeSnapshot({
      feedings: rawFeedings,
      sleeps: rawSleeps,
      diapers: rawDiapers,
    });

    const legacy = this.readLegacySnapshot();
    const merged = this.mergeSnapshots(cloud, legacy);

    this.validateConsistency(merged);

    if (legacy.feedings.length > 0) {
      this.assertSameUser(uid);

      await this.repository.saveRecords('feedings', legacy.feedings);

      this.assertSameUser(uid);
    }

    if (legacy.sleeps.length > 0) {
      this.assertSameUser(uid);

      await this.repository.saveRecords('sleeps', legacy.sleeps);

      this.assertSameUser(uid);
    }

    if (legacy.diapers.length > 0) {
      this.assertSameUser(uid);

      await this.repository.saveRecords('diapers', legacy.diapers);

      this.assertSameUser(uid);
    }

    await this.repository.saveProfile({
      recordsMigrationVersion: 1,
      recordsMigratedAt: new Date().toISOString(),
    });

    this.assertSameUser(uid);

    this.removeLegacyData();
  }

  private upsertFeeding(feedings: readonly Feeding[], feeding: Feeding): readonly Feeding[] {
    return [feeding, ...feedings.filter((item) => item.id !== feeding.id)].sort(
      (a, b) => b.startedAt - a.startedAt,
    );
  }

  private upsertSleep(sleeps: readonly Sleep[], sleep: Sleep): readonly Sleep[] {
    return [sleep, ...sleeps.filter((item) => item.id !== sleep.id)].sort(
      (a, b) => b.startedAt - a.startedAt,
    );
  }

  private upsertDiaper(diapers: readonly Diaper[], diaper: Diaper): readonly Diaper[] {
    return [diaper, ...diapers.filter((item) => item.id !== diaper.id)].sort(
      (a, b) => b.recordedAt - a.recordedAt,
    );
  }

  private updateSnapshot(uid: string, babyId: string, snapshot: ActivitySnapshot): void {
    this.assertSameContext(uid, babyId);

    const current = this.state();

    if (current.uid !== uid || current.babyId !== babyId || !current.ready) {
      throw new Error('Os registros ainda não foram carregados.');
    }

    /*
     * A exclusividade das atividades abertas agora
     * é garantida atomicamente pelo Firestore.
     *
     * O estado local não deve deixar de funcionar
     * caso existam registros antigos inconsistentes.
     */
    this.validateSnapshotIds(snapshot);

    this.state.set({
      ...current,
      snapshot,
      error: null,
    });
  }

  private requireReadyState(): {
    readonly uid: string;
    readonly babyId: string;
    readonly snapshot: ActivitySnapshot;
  } {
    const uid = this.requireUid();
    const babyId = this.requireActiveBabyId();
    const current = this.state();

    if (current.uid !== uid || current.babyId !== babyId || !current.ready) {
      throw new Error('Os registros ainda não foram carregados.');
    }

    return {
      uid,
      babyId,
      snapshot: current.snapshot,
    };
  }

  private clearError(uid: string, babyId: string): void {
    const current = this.state();

    if (current.uid !== uid || current.babyId !== babyId) {
      return;
    }

    this.state.set({
      ...current,
      error: null,
    });
  }

  private setSyncError(uid: string, babyId: string): void {
    if (this.auth.user()?.uid !== uid || this.babyContext.activeBabyId() !== babyId) {
      return;
    }

    const current = this.state();

    if (current.uid !== uid || current.babyId !== babyId) {
      return;
    }

    this.state.set({
      ...current,
      error: 'Não foi possível sincronizar os registros com a nuvem. Tente novamente.',
    });
  }

  private loadErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message === 'Os registros locais estão inválidos.') {
      return 'Os registros salvos neste dispositivo estão inválidos. ' + 'Eles não foram apagados.';
    }

    return 'Não foi possível carregar os registros. ' + 'Verifique sua conexão e tente novamente.';
  }

  private readLegacySnapshot(): ActivitySnapshot {
    const storage = this.getStorage();

    if (storage === null) {
      return EMPTY_SNAPSHOT;
    }

    const currentFeedings = storage.getItem(this.feedingKey);
    const oldFeedings = storage.getItem(this.legacyFeedingKey);
    const feedingSource = currentFeedings ?? oldFeedings;

    return this.normalizeSnapshot({
      feedings: this.parseStoredArray(feedingSource, (value) =>
        this.parseFeeding(value, currentFeedings === null && oldFeedings !== null),
      ),
      sleeps: this.parseStoredArray(storage.getItem(this.sleepKey), (value) =>
        this.parseSleep(value),
      ),
      diapers: this.parseStoredArray(storage.getItem(this.diaperKey), (value) =>
        this.parseDiaper(value),
      ),
    });
  }

  private parseStoredArray<T>(raw: string | null, parse: (value: unknown) => T): T[] {
    if (raw === null) {
      return [];
    }

    let value: unknown;

    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error('Os registros locais estão inválidos.');
    }

    if (!Array.isArray(value)) {
      throw new Error('Os registros locais estão inválidos.');
    }

    return value.map(parse);
  }

  private normalizeSnapshot(
    value: {
      feedings: readonly unknown[];
      sleeps: readonly unknown[];
      diapers: readonly unknown[];
    },
    allowConcurrentOpen = false,
  ): ActivitySnapshot {
    const snapshot: ActivitySnapshot = {
      feedings: value.feedings
        .map((item) => this.parseFeeding(item, false))
        .sort((a, b) => b.startedAt - a.startedAt),
      sleeps: value.sleeps
        .map((item) => this.parseSleep(item))
        .sort((a, b) => b.startedAt - a.startedAt),
      diapers: value.diapers
        .map((item) => this.parseDiaper(item))
        .sort((a, b) => b.recordedAt - a.recordedAt),
    };

    if (allowConcurrentOpen) {
      this.validateSnapshotIds(snapshot);
    } else {
      this.validateConsistency(snapshot);
    }

    return snapshot;
  }

  private mergeSnapshots(cloud: ActivitySnapshot, legacy: ActivitySnapshot): ActivitySnapshot {
    return this.normalizeSnapshot({
      feedings: this.mergeById(cloud.feedings, legacy.feedings),
      sleeps: this.mergeById(cloud.sleeps, legacy.sleeps),
      diapers: this.mergeById(cloud.diapers, legacy.diapers),
    });
  }

  private mergeById<T extends { readonly id: string }>(
    cloud: readonly T[],
    legacy: readonly T[],
  ): T[] {
    const records = new Map<string, T>();

    for (const record of cloud) {
      records.set(record.id, record);
    }

    for (const record of legacy) {
      records.set(record.id, record);
    }

    return [...records.values()];
  }

  private validateSnapshotIds(snapshot: ActivitySnapshot): void {
    this.validateUniqueIds(snapshot.feedings);
    this.validateUniqueIds(snapshot.sleeps);
    this.validateUniqueIds(snapshot.diapers);
  }

  private validateConsistency(snapshot: ActivitySnapshot): void {
    this.validateSnapshotIds(snapshot);

    const activeFeedings = snapshot.feedings.filter((feeding) => feeding.endedAt === null).length;

    const activeSleeps = snapshot.sleeps.filter((sleep) => sleep.endedAt === null).length;

    if (activeFeedings > 1 || activeSleeps > 1) {
      throw new Error('Os registros possuem atividades simultâneas inconsistentes.');
    }
  }

  private validateUniqueIds(
    records: readonly {
      readonly id: string;
    }[],
  ): void {
    const ids = new Set(records.map((record) => record.id));

    if (ids.size !== records.length) {
      throw new Error('Existem registros duplicados.');
    }
  }

  private parseFeeding(value: unknown, legacy: boolean): Feeding {
    if (!this.isObject(value)) {
      throw new Error('Registro de mamada inválido.');
    }

    const id = value['id'];
    const startedAt = value['startedAt'];
    const endedAt = value['endedAt'];
    const side = value['side'];

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      id.includes('/') ||
      !this.isTimestamp(startedAt) ||
      !(endedAt === null || (this.isTimestamp(endedAt) && endedAt >= startedAt)) ||
      !this.isSide(side)
    ) {
      throw new Error('Registro de mamada inválido.');
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

    const rawPeriods = value['periods'];

    if (rawPeriods === null) {
      return {
        ...base,
        periods: null,
      };
    }

    if (!Array.isArray(rawPeriods) || rawPeriods.length === 0) {
      throw new Error('Períodos de mamada inválidos.');
    }

    const periods: FeedingPeriod[] = [];
    let previousEnd = startedAt;

    for (let index = 0; index < rawPeriods.length; index++) {
      const raw = rawPeriods[index];

      if (!this.isObject(raw)) {
        throw new Error('Período de mamada inválido.');
      }

      const periodStart = raw['startedAt'];
      const periodEnd = raw['endedAt'];
      const periodSide = raw['side'];
      const isLast = index === rawPeriods.length - 1;

      if (
        !this.isTimestamp(periodStart) ||
        periodStart < startedAt ||
        !this.isSide(periodSide) ||
        !(periodEnd === null || (this.isTimestamp(periodEnd) && periodEnd >= periodStart))
      ) {
        throw new Error('Período de mamada inválido.');
      }

      if (index > 0 && periodStart !== previousEnd) {
        throw new Error('Períodos de mamada descontínuos.');
      }

      if (!isLast && periodEnd === null) {
        throw new Error('Período de mamada aberto em posição inválida.');
      }

      if (isLast && (periodEnd !== endedAt || periodSide !== side)) {
        throw new Error('Último período de mamada inconsistente.');
      }

      periods.push({
        startedAt: periodStart,
        endedAt: periodEnd,
        side: periodSide,
      });

      previousEnd = periodEnd ?? periodStart;
    }

    return {
      ...base,
      periods,
    };
  }

  private parseSleep(value: unknown): Sleep {
    if (!this.isObject(value)) {
      throw new Error('Registro de sono inválido.');
    }

    const id = value['id'];
    const startedAt = value['startedAt'];
    const endedAt = value['endedAt'];

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      id.includes('/') ||
      !this.isTimestamp(startedAt) ||
      !(endedAt === null || (this.isTimestamp(endedAt) && endedAt >= startedAt))
    ) {
      throw new Error('Registro de sono inválido.');
    }

    return {
      id,
      startedAt,
      endedAt,
    };
  }

  private parseDiaper(value: unknown): Diaper {
    if (!this.isObject(value)) {
      throw new Error('Registro de fralda inválido.');
    }

    const id = value['id'];
    const type = value['type'];
    const recordedAt = value['recordedAt'];

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      id.includes('/') ||
      !this.isDiaperType(type) ||
      !this.isTimestamp(recordedAt)
    ) {
      throw new Error('Registro de fralda inválido.');
    }

    return {
      id,
      type,
      recordedAt,
    };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isTimestamp(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 8_640_000_000_000_000
    );
  }

  private isSide(value: unknown): value is FeedingSide | null {
    return value === null || value === 'left' || value === 'right';
  }

  private isDiaperType(value: unknown): value is DiaperType {
    return value === 'wet' || value === 'dirty' || value === 'both';
  }

  private removeLegacyData(): void {
    const storage = this.getStorage();

    if (storage === null) {
      return;
    }

    try {
      storage.removeItem(this.feedingKey);
      storage.removeItem(this.legacyFeedingKey);
      storage.removeItem(this.sleepKey);
      storage.removeItem(this.diaperKey);
    } catch {
      /*
       * A nuvem já é a fonte de verdade.
       * Uma falha na limpeza local não
       * invalida a migração confirmada.
       */
    }
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

  private requireUid(): string {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      throw new Error('Usuário não autenticado.');
    }

    return uid;
  }

  private requireActiveBabyId(): string {
    const babyId = this.babyContext.activeBabyId();

    if (!babyId) {
      throw new Error('Bebê ativo não encontrado.');
    }

    return babyId;
  }

  private assertSameContext(uid: string, babyId: string): void {
    this.assertSameUser(uid);

    if (this.babyContext.activeBabyId() !== babyId) {
      throw new Error('O bebê ativo mudou durante a operação.');
    }
  }

  private assertSameUser(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A sessão mudou durante a sincronização.');
    }
  }
}
