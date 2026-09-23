import { Injectable, inject, signal } from '@angular/core';

import { BabyContextService } from './baby-context';
import type { BabyAccessRemovedNotification } from '../models/user-notification';
import { OnboardingService } from './onboarding';
import { UserNotificationRepository } from './user-notification.repository';

@Injectable({
  providedIn: 'root',
})
export class AccessRemovalService {
  private readonly notifications = inject(UserNotificationRepository);

  private readonly babyContext = inject(BabyContextService);

  private readonly onboarding = inject(OnboardingService);

  readonly notification = signal<BabyAccessRemovedNotification | null>(null);

  readonly loading = signal(false);

  readonly error = signal('');

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      this.notification.set(await this.notifications.unreadAccessRemoved());
    } catch {
      this.notification.set(null);
      this.error.set('Não foi possível verificar as notificações da sua conta.');
    } finally {
      this.loading.set(false);
    }
  }

  async acknowledge(): Promise<boolean> {
    const notification = this.notification();

    if (notification === null) {
      return false;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.notifications.acknowledgeAccessRemoved(notification);

      this.babyContext.reset();

      await this.onboarding.reload();

      this.notification.set(null);

      return true;
    } catch {
      this.error.set('Não foi possível concluir esta ação. Tente novamente.');

      return false;
    } finally {
      this.loading.set(false);
    }
  }
}