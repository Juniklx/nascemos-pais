import { Injectable, inject } from '@angular/core';

import { DocumentData, Timestamp, serverTimestamp } from 'firebase/firestore';

import { FirestoreGateway } from '../firebase/firestore.gateway';

import { BabyInvite } from '../models/baby-invite';

import { AuthService } from './auth';

const INVITE_DURATION_MS = 24 * 60 * 60 * 1000;

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

    const joinedAt = new Date().toISOString();

    /*
     * As três alterações precisam ocorrer
     * na mesma operação atômica.
     *
     * As Firestore Rules também exigem
     * exatamente esta relação.
     */
    await this.firestore.batchSet([
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
        },
      },

      {
        path: this.userPath(uid),

        data: {
          activeBabyId: invite.babyId,
        },
      },
    ]);

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

  private userPath(uid: string): string {
    return `users/${uid}`;
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
