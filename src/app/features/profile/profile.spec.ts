import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import type { BabyMember } from '../../core/models/baby';
import { AuthService } from '../../core/services/auth';
import { BabyContextService } from '../../core/services/baby-context';
import { BabyDataRepository } from '../../core/services/baby-data.repository';
import { BabyInviteRepository } from '../../core/services/baby-invite.repository';
import { OnboardingService } from '../../core/services/onboarding';
import { ThemeService } from '../../core/services/theme';
import { ProfilePage } from './profile';

describe('ProfilePage', () => {
  let page: ProfilePage;

  const isOwner = signal(true);
  const activeBabyId = signal<string | null>('baby-1');

  const createInvite = jasmine.createSpy('createInvite');
  const listMembers = jasmine.createSpy('listMembers');
  const removeBabyMember = jasmine.createSpy('removeMember');

  const owner: BabyMember = {
    uid: 'user-a',
    role: 'owner',
    joinedAt: '2026-01-01T00:00:00.000Z',
  };

  const caregiver: BabyMember = {
    uid: 'user-b',
    role: 'caregiver',
    joinedAt: '2026-01-02T00:00:00.000Z',
    inviteId: 'a'.repeat(64),
  };

  beforeEach(() => {
    isOwner.set(true);
    activeBabyId.set('baby-1');

    createInvite.calls.reset();
    listMembers.calls.reset();
    removeBabyMember.calls.reset();

    createInvite.and.resolveTo({
      id: 'a'.repeat(64),
      babyId: 'baby-1',
      createdByUid: 'user-a',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      status: 'pending',
      acceptedByUid: null,
      acceptedAt: null,
    });

    listMembers.and.resolveTo([owner, caregiver]);
    removeBabyMember.and.resolveTo();

    const caregiverName = signal('Marcelo');
    const babyName = signal('Helena');
    const babyBirthDate = signal('2026-01-01');
    const storageError = signal<string | null>(null);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingService,
          useValue: {
            caregiverName: caregiverName.asReadonly(),
            babyName: babyName.asReadonly(),
            babyBirthDate: babyBirthDate.asReadonly(),
            storageError: storageError.asReadonly(),
            updateProfile: jasmine.createSpy('updateProfile'),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate'),
          },
        },
        {
          provide: AuthService,
          useValue: {
            email: signal('teste@exemplo.com').asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            isLoading: signal(false).asReadonly(),
            logout: jasmine.createSpy('logout'),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false).asReadonly(),
            storageError: signal<string | null>(null).asReadonly(),
            toggle: jasmine.createSpy('toggle'),
          },
        },
        {
          provide: BabyContextService,
          useValue: {
            isOwner: isOwner.asReadonly(),
            activeBabyId: activeBabyId.asReadonly(),
          },
        },
        {
          provide: BabyInviteRepository,
          useValue: {
            createInvite,
          },
        },
        {
          provide: BabyDataRepository,
          useValue: {
            listMembers,
            removeMember: removeBabyMember,
          },
        },
      ],
    });

    page = TestBed.runInInjectionContext(() => new ProfilePage());
  });

  it('permite proprietário gerar convite', async () => {
    await page.generateInvite();

    expect(createInvite).toHaveBeenCalledOnceWith('baby-1');

    expect(page.inviteLink()).toContain(`/invite/${'a'.repeat(64)}`);

    expect(page.inviteMessage()).toContain('válido por 24 horas');
  });

  it('não permite responsável gerar convite', async () => {
    isOwner.set(false);

    await page.generateInvite();

    expect(createInvite).not.toHaveBeenCalled();
    expect(page.inviteLink()).toBe('');
    expect(page.inviteMessage()).toBe('Somente o proprietário do bebê pode convidar responsáveis.');
  });

  it('permite proprietário remover responsável', async () => {
    page.members.set([owner, caregiver]);

    await page.removeMember(caregiver);

    expect(removeBabyMember).toHaveBeenCalledOnceWith('baby-1', 'user-b');

    expect(page.members()).toEqual([owner]);

    expect(page.inviteMessage()).toBe('Responsável removido com sucesso.');
  });

  it('não permite responsável remover outro responsável', async () => {
    isOwner.set(false);

    page.members.set([caregiver]);

    await page.removeMember(caregiver);

    expect(removeBabyMember).not.toHaveBeenCalled();

    expect(page.members()).toEqual([caregiver]);
  });

  it('exibe nome real do responsável', () => {
    expect(
      page.memberLabel({
        uid: 'user-b',
        role: 'caregiver',
        joinedAt: '2026-01-02T00:00:00.000Z',
        caregiverName: 'Ana',
      }),
    ).toBe('Ana');
  });
});
