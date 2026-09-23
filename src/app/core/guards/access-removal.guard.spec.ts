import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import type { BabyAccessRemovedNotification } from '../models/user-notification';
import { AccessRemovalService } from '../services/access-removal';
import { accessRemovalGuard } from './access-removal.guard';

describe('accessRemovalGuard', () => {
  const notification = signal<BabyAccessRemovedNotification | null>(null);

  const load = jasmine.createSpy('load');

  const router = {
    createUrlTree: jasmine.createSpy('createUrlTree'),
  };

  beforeEach(() => {
    notification.set(null);

    load.calls.reset();
    router.createUrlTree.calls.reset();

    load.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AccessRemovalService,
          useValue: {
            notification: notification.asReadonly(),
            load,
          },
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('permite acesso quando não existe remoção pendente', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      accessRemovalGuard({} as never, {} as never),
    );

    expect(result).toBeTrue();
    expect(load).toHaveBeenCalled();
  });

  it('redireciona quando existe remoção pendente', async () => {
    notification.set({
      id: 'baby-access-removed-baby-1',
      type: 'baby-access-removed',
      babyId: 'baby-1',
      babyName: 'Helena',
      createdAt: 1000,
      readAt: null,
    });

    const expectedTree = {} as UrlTree;

    router.createUrlTree.and.returnValue(expectedTree);

    const result = await TestBed.runInInjectionContext(() =>
      accessRemovalGuard({} as never, {} as never),
    );

    expect(result).toBe(expectedTree);

    expect(router.createUrlTree).toHaveBeenCalledOnceWith(['/access-removed']);
  });
});