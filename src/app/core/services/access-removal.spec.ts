import { TestBed } from '@angular/core/testing';

import type { BabyAccessRemovedNotification } from '../models/user-notification';
import { AccessRemovalService } from './access-removal';
import { BabyContextService } from './baby-context';
import { OnboardingService } from './onboarding';
import { UserNotificationRepository } from './user-notification.repository';

describe('AccessRemovalService', () => {
  let service: AccessRemovalService;

  const notification: BabyAccessRemovedNotification = {
    id: 'baby-access-removed-baby-1',
    type: 'baby-access-removed',
    babyId: 'baby-1',
    babyName: 'Helena',
    createdAt: 1000,
    readAt: null,
  };

  const notifications = {
    unreadAccessRemoved: jasmine.createSpy('unreadAccessRemoved'),
    acknowledgeAccessRemoved: jasmine.createSpy('acknowledgeAccessRemoved'),
  };

  const onboarding = {
    reload: jasmine.createSpy('reload'),
  };

  const babyContext = {
    reset: jasmine.createSpy('reset'),
  };

  beforeEach(() => {
    notifications.unreadAccessRemoved.calls.reset();
    notifications.acknowledgeAccessRemoved.calls.reset();
    onboarding.reload.calls.reset();
    babyContext.reset.calls.reset();

    notifications.unreadAccessRemoved.and.resolveTo(notification);
    notifications.acknowledgeAccessRemoved.and.resolveTo();
    onboarding.reload.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        AccessRemovalService,
        {
          provide: UserNotificationRepository,
          useValue: notifications,
        },
        {
          provide: OnboardingService,
          useValue: onboarding,
        },
        {
          provide: BabyContextService,
          useValue: babyContext,
        },
      ],
    });

    service = TestBed.inject(AccessRemovalService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carrega notificação de acesso removido', async () => {
    await service.load();

    expect(service.notification()).toEqual(notification);
    expect(service.error()).toBe('');
  });

  it('confirma remoção, limpa contexto e recarrega onboarding', async () => {
    await service.load();

    const result = await service.acknowledge();

    expect(result).toBeTrue();

    expect(notifications.acknowledgeAccessRemoved).toHaveBeenCalledOnceWith(notification);
    expect(babyContext.reset).toHaveBeenCalled();
    expect(onboarding.reload).toHaveBeenCalled();
    expect(service.notification()).toBeNull();
  });

  it('mantém notificação quando a confirmação falha', async () => {
    await service.load();

    notifications.acknowledgeAccessRemoved.and.rejectWith(new Error('Firestore indisponível'));

    const result = await service.acknowledge();

    expect(result).toBeFalse();
    expect(service.notification()).toEqual(notification);
    expect(babyContext.reset).not.toHaveBeenCalled();
    expect(onboarding.reload).not.toHaveBeenCalled();
    expect(service.error()).toContain('Não foi possível concluir');
  });
});