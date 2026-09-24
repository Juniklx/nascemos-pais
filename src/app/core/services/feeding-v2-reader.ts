import { Injectable, inject } from '@angular/core';
import type { Feeding } from '../models/feeding';
import { hydrateFeedingV2 } from '../utils/hydrate-feeding-v2';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';

const V2_STATE_KEYS = [
  'id', 'storageVersion', 'startedAt', 'endedAt', 'side', 'periodCount',
  'lastPeriodId', 'lastPeriodStartedAt', 'createdByUid', 'finishedByUid',
] as const;

/**
 * Compatibilidade de leitura em branch experimental.
 * O serviço nunca grava ou migra registros e falha se receber dados v2 parciais.
 */
@Injectable({ providedIn: 'root' })
export class FeedingV2Reader {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreGateway);

  hasVersioned(raw: readonly unknown[]): boolean {
    return raw.some((item) => isRecord(item) && 'storageVersion' in item);
  }

  async hydrate(babyId: string, raw: readonly unknown[]): Promise<readonly Feeding[]> {
    const uid = this.auth.user()?.uid;

    if (!uid || !validId(babyId)) {
      throw new Error('Não foi possível verificar a conta ou o bebê.');
    }

    const feedings = await Promise.all(raw.map(async (item): Promise<Feeding> => {
      if (!isRecord(item)) {
        throw new Error('O histórico contém uma mamada inválida.');
      }

      if (!('storageVersion' in item)) {
        // A normalização existente valida todos os campos v1 após essa etapa.
        return item as unknown as Feeding;
      }

      if (item['storageVersion'] !== 2 || !validId(item['id'])) {
        throw new Error('Foi encontrada uma versão de mamada não suportada.');
      }

      const path = `babies/${babyId}/feedings/${item['id']}`;
      // Não combinar o cache local com períodos possivelmente incompletos.
      const [fresh, periods] = await Promise.all([
        this.firestore.getFromServer(path),
        this.firestore.listFromServer(`${path}/periods`),
      ]);
      this.assertSession(uid);

      if (!fresh || V2_STATE_KEYS.some((key) => item[key] !== fresh[key])) {
        throw new Error('A mamada mudou durante a consulta. Tente sincronizar novamente.');
      }

      return { ...hydrateFeedingV2(fresh, periods), storageVersion: 2 };
    }));

    this.assertSession(uid);
    return feedings;
  }

  private assertSession(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A conta mudou durante o carregamento das mamadas.');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !value.includes('/');
}
