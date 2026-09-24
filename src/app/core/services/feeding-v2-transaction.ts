import { Injectable, inject } from '@angular/core';
import type { DocumentData } from 'firebase/firestore';
import type { FeedingSide } from '../models/feeding';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';

/**
 * Protótipo ISOLADO: não é injetado pelo fluxo de mamadas atual.
 * Só deverá entrar em produção após regras v2, histórico e exportação LGPD.
 */
@Injectable({ providedIn: 'root' })
export class FeedingV2TransactionRepository {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreGateway);

  async start(babyId: string, feedingId: string, now = Date.now()): Promise<void> {
    const uid = this.requireUid();
    this.validateIds(babyId, feedingId);
    this.validateTime(now);

    await this.firestore.transaction(async (tx) => {
      const base = this.parentPath(babyId, feedingId);
      const [lock, existing, period] = await Promise.all([
        tx.get(this.lockPath(babyId)),
        tx.get(base),
        tx.get(this.periodPath(base, 0)),
      ]);
      this.assertSession(uid);

      if (lock || existing || period) {
        throw new Error('Já existe uma mamada ou uma atividade em andamento.');
      }

      tx.set(base, {
        id: feedingId,
        storageVersion: 2,
        startedAt: now,
        endedAt: null,
        side: null,
        periodCount: 1,
        lastPeriodId: this.periodId(0),
        lastPeriodStartedAt: now,
        createdByUid: uid,
      }, false);
      tx.set(this.periodPath(base, 0), {
        id: this.periodId(0),
        index: 0,
        startedAt: now,
        endedAt: null,
        side: null,
      }, false);
      tx.set(this.lockPath(babyId), { recordId: feedingId }, false);
    });

    this.assertSession(uid);
  }

  async switchSide(
    babyId: string,
    feedingId: string,
    side: FeedingSide | null,
    now = Date.now(),
  ): Promise<boolean> {
    const uid = this.requireUid();
    this.validateIds(babyId, feedingId);
    this.validateTime(now);
    this.validateSide(side);

    const changed = await this.firestore.transaction(async (tx) => {
      const parentPath = this.parentPath(babyId, feedingId);
      const [parent, lock] = await Promise.all([
        tx.get(parentPath),
        tx.get(this.lockPath(babyId)),
      ]);
      this.assertSession(uid);
      this.requireOpen(parent, lock, feedingId);

      if (parent!['side'] === side) {
        return false;
      }

      const count = parent!['periodCount'] as number;
      const lastId = parent!['lastPeriodId'] as string;

      if (count >= 99999999 || lastId !== this.periodId(count - 1)) {
        throw new Error('Sequência de períodos inválida.');
      }

      const priorPath = `${parentPath}/periods/${lastId}`;
      const nextPath = this.periodPath(parentPath, count);
      const [prior, duplicate] = await Promise.all([tx.get(priorPath), tx.get(nextPath)]);
      this.assertSession(uid);

      if (
        !prior ||
        prior['endedAt'] !== null ||
        prior['startedAt'] !== parent!['lastPeriodStartedAt'] ||
        prior['index'] !== count - 1 ||
        duplicate !== null
      ) {
        throw new Error('Os períodos foram alterados. Atualize a mamada.');
      }

      const startedAt = Math.max(now, prior['startedAt'] as number);
      tx.set(priorPath, { endedAt: startedAt }, true);
      tx.set(nextPath, {
        id: this.periodId(count),
        index: count,
        startedAt,
        endedAt: null,
        side,
      }, false);
      tx.set(parentPath, {
        periodCount: count + 1,
        lastPeriodId: this.periodId(count),
        lastPeriodStartedAt: startedAt,
        side,
      }, true);

      return true;
    });

    this.assertSession(uid);
    return changed;
  }

  async finish(babyId: string, feedingId: string, now = Date.now()): Promise<void> {
    const uid = this.requireUid();
    this.validateIds(babyId, feedingId);
    this.validateTime(now);

    await this.firestore.transaction(async (tx) => {
      const parentPath = this.parentPath(babyId, feedingId);
      const lockPath = this.lockPath(babyId);
      const [parent, lock] = await Promise.all([tx.get(parentPath), tx.get(lockPath)]);
      this.assertSession(uid);
      this.requireOpen(parent, lock, feedingId);

      const count = parent!['periodCount'] as number;
      const lastId = parent!['lastPeriodId'] as string;

      if (lastId !== this.periodId(count - 1)) {
        throw new Error('Sequência de períodos inválida.');
      }

      const path = `${parentPath}/periods/${lastId}`;
      const last = await tx.get(path);
      this.assertSession(uid);

      if (
        !last ||
        last['index'] !== count - 1 ||
        last['endedAt'] !== null ||
        last['startedAt'] !== parent!['lastPeriodStartedAt']
      ) {
        throw new Error('Não foi possível verificar o último período.');
      }

      const endedAt = Math.max(now, last['startedAt'] as number);
      tx.set(path, { endedAt }, true);
      tx.set(parentPath, { endedAt, finishedByUid: uid }, true);
      tx.delete(lockPath);
    });

    this.assertSession(uid);
  }

  private requireOpen(
    parent: DocumentData | null,
    lock: DocumentData | null,
    feedingId: string,
  ): void {
    if (
      parent?.['storageVersion'] !== 2 ||
      parent['id'] !== feedingId ||
      parent['endedAt'] !== null ||
      typeof parent['periodCount'] !== 'number' ||
      !Number.isSafeInteger(parent['periodCount']) ||
      parent['periodCount'] < 1 ||
      typeof parent['lastPeriodId'] !== 'string' ||
      typeof parent['lastPeriodStartedAt'] !== 'number' ||
      lock?.['recordId'] !== feedingId
    ) {
      throw new Error('A mamada não está disponível ou sofreu alterações.');
    }
  }

  private parentPath(babyId: string, feedingId: string): string {
    return `babies/${babyId}/feedings/${feedingId}`;
  }

  private periodPath(parentPath: string, index: number): string {
    return `${parentPath}/periods/${this.periodId(index)}`;
  }

  private periodId(index: number): string {
    return String(index).padStart(8, '0');
  }

  private lockPath(babyId: string): string {
    return `babies/${babyId}/activeActivities/feeding`;
  }

  private validateIds(...ids: string[]): void {
    if (ids.some((id) => !id.trim() || id.includes('/'))) {
      throw new Error('Identificador inválido.');
    }
  }

  private validateTime(now: number): void {
    if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000) {
      throw new Error('Horário inválido.');
    }
  }

  private validateSide(side: FeedingSide | null): void {
    if (side !== null && side !== 'left' && side !== 'right') {
      throw new Error('Lado inválido.');
    }
  }

  private requireUid(): string {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      throw new Error('Entre na conta antes de registrar uma mamada.');
    }

    return uid;
  }

  private assertSession(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A sessão mudou. Atualize os registros antes de continuar.');
    }
  }
}
