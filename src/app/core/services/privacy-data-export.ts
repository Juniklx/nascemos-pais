import { Injectable, inject } from '@angular/core';
import type { DocumentData } from 'firebase/firestore';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';
import { FeedingV2Reader } from './feeding-v2-reader';

type ActivityCollection = 'feedings' | 'sleeps' | 'diapers';

export interface PrivacyExport {
  readonly format: 'nascemos-pais-export';
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly account: {
    readonly email: string | null;
    readonly profile: Record<string, unknown>;
    readonly notifications: readonly Record<string, unknown>[];
    readonly legacy: Record<ActivityCollection, readonly Record<string, unknown>[]>;
  };
  readonly babies: readonly {
    readonly baby: Record<string, unknown>;
    readonly role: string;
    readonly records: Record<ActivityCollection, readonly Record<string, unknown>[]>;
  }[];
}

@Injectable({ providedIn: 'root' })
export class PrivacyDataExportService {
  private readonly auth = inject(AuthService);
  private readonly context = inject(BabyContextService);
  private readonly firestore = inject(FirestoreGateway);
  private readonly feedingV2Reader = inject(FeedingV2Reader);

  async collect(): Promise<PrivacyExport> {
    await this.auth.waitUntilReady();
    const uid = this.auth.user()?.uid;

    if (!uid) {
      throw new Error('É necessário entrar na conta para exportar os dados.');
    }

    await this.context.ensureLoaded();
    this.assertSession(uid);

    // Todas as leituras devem vir do servidor para não exportar um cache incompleto.
    const profile = await this.firestore.getFromServer(`users/${uid}`);
    this.assertSession(uid);

    if (!profile) {
      throw new Error('Não foi possível localizar os dados da sua conta.');
    }

    const references = await this.firestore.listFromServer(`users/${uid}/babies`);
    this.assertSession(uid);

    const activeId = this.context.activeBabyId();

    if (activeId && !references.some((item) => item['id'] === activeId)) {
      throw new Error('A lista de bebês está incompleta. Não foi gerado um arquivo parcial.');
    }

    const legacy = await this.loadCollections(`users/${uid}`, uid);
    const notifications = await this.firestore.listFromServer(`users/${uid}/notifications`);
    this.assertSession(uid);

    const babies: PrivacyExport['babies'][number][] = [];
    const seen = new Set<string>();

    for (const reference of references) {
      const babyId = reference['id'];

      if (typeof babyId !== 'string' || babyId.trim() === '' || babyId.includes('/')) {
        throw new Error('Foi encontrada uma referência inválida. A exportação foi cancelada.');
      }

      if (seen.has(babyId)) {
        continue;
      }

      seen.add(babyId);
      this.assertSession(uid);

      const member = await this.firestore.getFromServer(`babies/${babyId}/members/${uid}`);
      this.assertSession(uid);

      if (member === null) {
        // Um vínculo pode ter sido revogado enquanto a exportação estava em andamento.
        throw new Error('Seu acesso a um dos bebês mudou. Reinicie a exportação.');
      }

      const baby = await this.firestore.getFromServer(`babies/${babyId}`);
      this.assertSession(uid);

      if (!baby) {
        throw new Error('Um bebê vinculado não está mais disponível. Reinicie a exportação.');
      }

      const records = await this.loadCollections(`babies/${babyId}`, uid);

      babies.push({
        baby: this.only(baby, ['name', 'birthDate', 'createdAt', 'updatedAt'], babyId),
        role: member['role'] === 'owner' ? 'owner' : 'caregiver',
        records,
      });
    }

    // Verifica novamente os vínculos após coletar os registros de todos os bebês.
    for (const item of babies) {
      const babyId = item.baby['id'];

      if (typeof babyId !== 'string') {
        throw new Error('Foi encontrada uma referência inválida. A exportação foi cancelada.');
      }

      const membership = await this.firestore.getFromServer(`babies/${babyId}/members/${uid}`);
      this.assertSession(uid);

      if (!membership) {
        throw new Error('Seu acesso a um dos bebês mudou. Reinicie a exportação.');
      }
    }

    return {
      format: 'nascemos-pais-export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      account: {
        email: this.auth.user()?.email ?? null,
        profile: this.only(profile, [
          'caregiverName', 'babyName', 'babyBirthDate', 'consentGiven', 'consentAt',
          'createdAt', 'updatedAt',
        ]),
        notifications: notifications.map((item) =>
          this.only(item, ['type', 'babyId', 'babyName', 'createdAt', 'readAt'], String(item['id'] ?? '')),
        ),
        legacy,
      },
      babies,
    };
  }

  private async loadCollections(
    prefix: string,
    uid: string,
  ): Promise<Record<ActivityCollection, readonly Record<string, unknown>[]>> {
    const feedings = await this.firestore.listFromServer(`${prefix}/feedings`);
    this.assertSession(uid);

    // Mamadas v2 guardam os períodos em subcoleções. Nunca exportar somente
    // o documento pai nem interpretar um formato desconhecido como v1.
    let completeFeedings = feedings;

    if (this.feedingV2Reader.hasVersioned(feedings)) {
      if (!prefix.startsWith('babies/')) {
        throw new Error('Formato inesperado no histórico legado. A exportação foi cancelada.');
      }

      const babyId = prefix.slice('babies/'.length);
      const hydrated = await this.feedingV2Reader.hydrate(babyId, feedings);
      this.assertSession(uid);

      completeFeedings = feedings.map((item, index) =>
        'storageVersion' in item ? { ...item, periods: hydrated[index].periods } : item,
      );
    }

    const sleeps = await this.firestore.listFromServer(`${prefix}/sleeps`);
    this.assertSession(uid);
    const diapers = await this.firestore.listFromServer(`${prefix}/diapers`);
    this.assertSession(uid);

    return {
      feedings: completeFeedings.map((item) => this.activity(item, 'feedings', uid)),
      sleeps: sleeps.map((item) => this.activity(item, 'sleeps', uid)),
      diapers: diapers.map((item) => this.activity(item, 'diapers', uid)),
    };
  }

  private activity(data: DocumentData, kind: ActivityCollection, uid: string): Record<string, unknown> {
    const keys = kind === 'feedings'
      ? data['storageVersion'] === 2
        ? ['storageVersion', 'startedAt', 'endedAt', 'side', 'periodCount',
          'lastPeriodId', 'lastPeriodStartedAt', 'periods']
        : ['startedAt', 'endedAt', 'side', 'periods']
      : kind === 'sleeps'
        ? ['startedAt', 'endedAt']
        : ['type', 'recordedAt'];

    const record = this.only(data, keys, String(data['id'] ?? ''));

    if (typeof data['createdByUid'] === 'string') {
      record['createdBy'] = data['createdByUid'] === uid ? 'propria_conta' : 'outro_responsavel';
    }

    if (typeof data['finishedByUid'] === 'string') {
      record['finishedBy'] = data['finishedByUid'] === uid ? 'propria_conta' : 'outro_responsavel';
    }

    return record;
  }

  private only(data: DocumentData, keys: readonly string[], id?: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (id) {
      result['id'] = id;
    }

    for (const key of keys) {
      if (key in data) {
        result[key] = this.serialize(data[key]);
      }
    }

    return result;
  }

  private serialize(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if ('toDate' in value && typeof value.toDate === 'function') {
      const date = value.toDate();

      return date instanceof Date ? date.toISOString() : null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serialize(item));
    }

    // Somente os campos esperados de períodos são exportados; sem dados internos.
    const item = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of ['startedAt', 'endedAt', 'side']) {
      if (key in item) {
        result[key] = this.serialize(item[key]);
      }
    }

    return result;
  }

  private assertSession(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A conta mudou durante a exportação. Nenhum arquivo foi gerado.');
    }
  }
}
