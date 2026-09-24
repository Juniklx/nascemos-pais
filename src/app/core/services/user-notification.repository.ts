import { Injectable, inject } from '@angular/core';
import { DocumentData, Timestamp, deleteField, serverTimestamp } from 'firebase/firestore';

import { FirestoreGateway } from '../firebase/firestore.gateway';
import type { BabyAccessRemovedNotification } from '../models/user-notification';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root',
})
export class UserNotificationRepository {
  private readonly auth = inject(AuthService);

  private readonly firestore = inject(FirestoreGateway);

  async unreadAccessRemoved(): Promise<BabyAccessRemovedNotification | null> {
    await this.auth.waitUntilReady();

    const uid = this.requireUid();

    const notifications = await this.firestore.list(this.notificationsPath(uid));

    this.assertSameUser(uid);

    const unread = notifications
      .map((notification) => this.parseNotification(notification))
      .filter((notification) => notification.readAt === null)
      .sort((a, b) => b.createdAt - a.createdAt);

    return unread[0] ?? null;
  }

  async acknowledgeAccessRemoved(
    notification: BabyAccessRemovedNotification,
  ): Promise<void> {
    await this.auth.waitUntilReady();

    const uid = this.requireUid();

    this.validateId(notification.id);

    const profile = await this.firestore.get(this.userPath(uid));

    this.assertSameUser(uid);

    const activeBabyId = profile?.['activeBabyId'];

    const shouldClearBaby = activeBabyId === notification.babyId;

    await this.firestore.batchWrite([
      {
        type: 'set',
        path: this.notificationPath(uid, notification.id),
        data: {
          readAt: serverTimestamp(),
        },
        merge: true,
      },
      ...(shouldClearBaby
        ? [
            {
              type: 'set' as const,
              path: this.userPath(uid),
              data: {
                babyName: '',
                babyBirthDate: '',
                activeBabyId: deleteField(),
                babyMigrationVersion: deleteField(),
                babyMigratedAt: deleteField(),
              },
              merge: true,
            },
          ]
        : []),
    ]);

    this.assertSameUser(uid);
  }

  private parseNotification(data: DocumentData): BabyAccessRemovedNotification {
    const id = data['id'];
    const type = data['type'];
    const babyId = data['babyId'];
    const babyName = data['babyName'];
    const createdAt = data['createdAt'];
    const readAt = data['readAt'];

    if (
      typeof id !== 'string' ||
      type !== 'baby-access-removed' ||
      typeof babyId !== 'string' ||
      babyId.trim().length === 0 ||
      typeof babyName !== 'string' ||
      babyName.trim().length === 0 ||
      !(createdAt instanceof Timestamp) ||
      (readAt !== null && !(readAt instanceof Timestamp))
    ) {
      throw new Error('Notificação inválida.');
    }

    return {
      id,
      type,
      babyId,
      babyName: babyName.trim(),
      createdAt: createdAt.toMillis(),
      readAt: readAt instanceof Timestamp ? readAt.toMillis() : null,
    };
  }

  private notificationsPath(uid: string): string {
    return `${this.userPath(uid)}/notifications`;
  }

  private notificationPath(uid: string, notificationId: string): string {
    return `${this.notificationsPath(uid)}/${notificationId}`;
  }

  private userPath(uid: string): string {
    return `users/${uid}`;
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

  private validateId(id: string): void {
    if (id.trim().length === 0 || id.includes('/')) {
      throw new Error('ID inválido.');
    }
  }
}