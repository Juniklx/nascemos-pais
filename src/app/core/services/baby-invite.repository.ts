import { Injectable, inject } from '@angular/core';
import { DocumentData, Timestamp, serverTimestamp } from 'firebase/firestore';

import { FirestoreGateway, type FirestoreBatchEntry } from '../firebase/firestore.gateway';
import { BabyInvite } from '../models/baby-invite';
import { AuthService } from './auth';

/*
 * Usamos até 23 horas no cliente para
 * tolerar diferenças entre o relógio do
 * dispositivo e o horário do Firestore.
 *
 * As Rules continuam limitando convites
 * a no máximo 24 horas no servidor.
 */
const INVITE_DURATION_MS = 23 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class BabyInviteRepository {
  private readonly auth = inject(AuthService);

  private readonly firestore = inject(FirestoreGateway);

  async createInvite(babyId: string): Promise<BabyInvite> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const token = this.createInviteToken();

    const now = Date.now();

    const expiresAt = now + INVITE_DURATION_MS;

    await this.firestore.set(
      this.invitePath(token),
      {
        babyId,

        createdByUid: uid,

        /*
         * serverTimestamp() é importante
         * porque as Rules comparam este
         * valor ao horário do servidor.
         */
        createdAt: serverTimestamp(),

        expiresAt: Timestamp.fromMillis(expiresAt),

        status: 'pending',
      },
      false,
    );

    this.assertSameUser(uid);

    return {
      id: token,

      babyId,

      createdByUid: uid,

      createdAt: now,

      expiresAt,

      status: 'pending',

      acceptedByUid: null,

      acceptedAt: null,
    };
  }

  async readInvite(token: string): Promise<BabyInvite | null> {
    const uid = this.requireUid();

    const normalizedToken = this.normalizeToken(token);

    const data = await this.firestore.get(this.invitePath(normalizedToken));

    this.assertSameUser(uid);

    if (data === null) {
      return null;
    }

    return this.parseInvite(normalizedToken, data);
  }

  async acceptInvite(token: string): Promise<string> {
    /*
     * O UID é capturado apenas uma vez.
     * Assim uma troca de sessão no meio
     * da operação não pode associar o
     * convite a outra conta.
     */
    const uid = this.requireUid();

    const normalizedToken = this.normalizeToken(token);

    const data = await this.firestore.get(this.invitePath(normalizedToken));

    this.assertSameUser(uid);

    if (data === null) {
      throw new Error('Convite não encontrado.');
    }

    const invite = this.parseInvite(normalizedToken, data);

    if (invite.status !== 'pending') {
      throw new Error('Este convite já foi utilizado.');
    }

    if (invite.expiresAt <= Date.now()) {
      throw new Error('Este convite expirou.');
    }

    if (invite.createdByUid === uid) {
      throw new Error('O proprietário não pode aceitar o próprio convite.');
    }

    this.validateId(invite.babyId);

    const profile = await this.firestore.get(this.userPath(uid));

    this.assertSameUser(uid);

    const caregiverName = profile?.['caregiverName'];

    if (
      typeof caregiverName !== 'string' ||
      caregiverName.trim().length === 0 ||
      caregiverName.trim().length > 80
    ) {
      throw new Error('Nome do responsável inválido.');
    }

    /*
     * Se este usuário já foi removido anteriormente
     * do mesmo bebê, pode existir uma notificação
     * antiga ainda não lida.
     *
     * Ao aceitar um novo convite, essa mensagem
     * deixa de representar o estado atual e deve
     * ser marcada como lida no mesmo lote.
     */
    const removalNotification = await this.firestore.get(this.notificationPath(uid, invite.babyId));

    this.assertSameUser(uid);

    const hasPendingRemovalNotification =
      removalNotification?.['type'] === 'baby-access-removed' &&
      removalNotification['babyId'] === invite.babyId &&
      removalNotification['readAt'] === null;

    const joinedAt = new Date().toISOString();

    /*
     * Convite, vínculo, bebê ativo e eventual
     * limpeza da notificação antiga são gravados
     * de forma atômica.
     */
    const entries: FirestoreBatchEntry[] = [
      {
        path: this.invitePath(normalizedToken),

        data: {
          status: 'accepted',

          acceptedByUid: uid,

          acceptedAt: serverTimestamp(),
        },
      },

      {
        path: this.memberPath(invite.babyId, uid),

        data: {
          role: 'caregiver',

          joinedAt,

          inviteId: normalizedToken,

          caregiverName: caregiverName.trim(),
        },
      },

      {
        path: this.userBabyPath(uid, invite.babyId),

        data: {
          role: 'caregiver',

          joinedAt,
        },
      },

      {
        path: this.userPath(uid),

        data: {
          activeBabyId: invite.babyId,
        },
      },
    ];

    if (hasPendingRemovalNotification) {
      entries.push({
        path: this.notificationPath(uid, invite.babyId),

        data: {
          readAt: serverTimestamp(),
        },
      });
    }

    await this.firestore.batchSet(entries);

    this.assertSameUser(uid);

    return invite.babyId;
  }

  private parseInvite(id: string, data: DocumentData): BabyInvite {
    const babyId = data['babyId'];

    const createdByUid = data['createdByUid'];

    const createdAt = data['createdAt'];

    const expiresAt = data['expiresAt'];

    const status = data['status'];

    if (
      typeof babyId !== 'string' ||
      babyId.trim().length === 0 ||
      babyId.includes('/') ||
      typeof createdByUid !== 'string' ||
      createdByUid.trim().length === 0 ||
      !(createdAt instanceof Timestamp) ||
      !(expiresAt instanceof Timestamp) ||
      (status !== 'pending' && status !== 'accepted')
    ) {
      throw new Error('Convite inválido.');
    }

    const createdAtMillis = createdAt.toMillis();

    const expiresAtMillis = expiresAt.toMillis();

    if (expiresAtMillis <= createdAtMillis) {
      throw new Error('Convite inválido.');
    }

    if (status === 'pending') {
      return {
        id,

        babyId,

        createdByUid,

        createdAt: createdAtMillis,

        expiresAt: expiresAtMillis,

        status,

        acceptedByUid: null,

        acceptedAt: null,
      };
    }

    const acceptedByUid = data['acceptedByUid'];

    const acceptedAt = data['acceptedAt'];

    if (
      typeof acceptedByUid !== 'string' ||
      acceptedByUid.trim().length === 0 ||
      !(acceptedAt instanceof Timestamp)
    ) {
      throw new Error('Convite inválido.');
    }

    return {
      id,

      babyId,

      createdByUid,

      createdAt: createdAtMillis,

      expiresAt: expiresAtMillis,

      status,

      acceptedByUid,

      acceptedAt: acceptedAt.toMillis(),
    };
  }

  private createInviteToken(): string {
    /*
     * 32 bytes aleatórios = 256 bits.
     *
     * Em hexadecimal produzimos um token
     * de 64 caracteres, dentro do limite
     * de 32–128 exigido pelas Rules.
     */
    const bytes = new Uint8Array(32);

    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private normalizeToken(token: string): string {
    const normalized = token.trim();

    if (normalized.length < 32 || normalized.length > 128 || normalized.includes('/')) {
      throw new Error('Token de convite inválido.');
    }

    return normalized;
  }

  private invitePath(token: string): string {
    return `babyInvites/${token}`;
  }

  private memberPath(babyId: string, uid: string): string {
    return `babies/${babyId}/members/${uid}`;
  }

  private notificationPath(uid: string, babyId: string): string {
    return `users/${uid}/notifications/baby-access-removed-${babyId}`;
  }

  private userPath(uid: string): string {
    return `users/${uid}`;
  }

  private userBabyPath(uid: string, babyId: string): string {
    return `${this.userPath(uid)}/babies/${babyId}`;
  }

  private validateId(id: string): void {
    if (id.trim().length === 0 || id.includes('/')) {
      throw new Error('ID inválido.');
    }
  }

  private requireUid(): string {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      throw new Error('Usuário não autenticado.');
    }

    return uid;
  }

  private assertSameUser(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A sessão mudou durante a operação.');
    }
  }
}
