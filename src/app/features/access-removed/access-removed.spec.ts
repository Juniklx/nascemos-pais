import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import type { BabyAccessRemovedNotification } from '../../core/models/user-notification';
import { AccessRemovalService } from '../../core/services/access-removal';
import { OnboardingService } from '../../core/services/onboarding';
import { AccessRemovedPage } from './access-removed';

describe('AccessRemovedPage', () => {
  let page: AccessRemovedPage;

  const notification = signal<BabyAccessRemovedNotification | null>(null);

  const loading = signal(false);

  const error = signal('');

  const load = jasmine.createSpy('load');

  const acknowledge = jasmine.createSpy('acknowledge');

  const getIncompleteRoute = jasmine.createSpy('getIncompleteRoute');

  const navigate = jasmine.createSpy('navigate');

  beforeEach(() => {
    notification.set(null);
    loading.set(false);
    error.set('');

    load.calls.reset();
    acknowledge.calls.reset();
    getIncompleteRoute.calls.reset();
    navigate.calls.reset();

    load.and.resolveTo();
    acknowledge.and.resolveTo(true);
    getIncompleteRoute.and.returnValue('/onboarding/about-baby');
    navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AccessRemovalService,
          useValue: {
            notification: notification.asReadonly(),
            loading: loading.asReadonly(),
            error: error.asReadonly(),
            load,
            acknowledge,
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            getIncompleteRoute,
          },
        },
        {
          provide: Router,
          useValue: {
            navigate,
          },
        },
      ],
    });

    page = TestBed.runInInjectionContext(() => new AccessRemovedPage());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('permanece na tela quando existe notificação pendente', async () => {
    notification.set({
      id: 'baby-access-removed-baby-1',
      type: 'baby-access-removed',
      babyId: 'baby-1',
      babyName: 'Helena',
      createdAt: 1000,
      readAt: null,
    });

    await page.ngOnInit();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('volta para home quando não existe notificação pendente', async () => {
    await page.ngOnInit();

    expect(navigate).toHaveBeenCalledOnceWith(['/home']);
  });

  it('confirma remoção e segue para a rota adequada', async () => {
    notification.set({
      id: 'baby-access-removed-baby-1',
      type: 'baby-access-removed',
      babyId: 'baby-1',
      babyName: 'Helena',
      createdAt: 1000,
      readAt: null,
    });

    await page.acknowledge();

    expect(acknowledge).toHaveBeenCalled();
    expect(getIncompleteRoute).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnceWith(['/onboarding/about-baby']);
  });
});