import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { User } from 'firebase/auth';
import { AuthService } from '../../core/services/auth';
import { BabyContextService } from '../../core/services/baby-context';
import { BabyInviteRepository } from '../../core/services/baby-invite.repository';
import { OnboardingService } from '../../core/services/onboarding';
import { InvitePage } from './invite';

describe('InvitePage', () => {
  let page: InvitePage;

  const token = 'a'.repeat(64);

  const user = signal<User | null>({
    uid: 'user-b',
  } as User);

  const readInvite = jasmine.createSpy('readInvite');

  const acceptInvite = jasmine.createSpy('acceptInvite');

  const ensureLoaded = jasmine.createSpy('ensureLoaded');

  const reloadOnboarding = jasmine.createSpy('reloadOnboarding');

  const reloadBaby = jasmine.createSpy('reloadBaby');

  const ensureBabyLoaded = jasmine.createSpy('ensureBabyLoaded');

  const getIncompleteRoute = jasmine.createSpy('getIncompleteRoute');

  const navigate = jasmine.createSpy('navigate');

  const navigateByUrl = jasmine.createSpy('navigateByUrl');

  beforeEach(() => {
    user.set({
      uid: 'user-b',
    } as User);

    readInvite.calls.reset();

    acceptInvite.calls.reset();

    ensureLoaded.calls.reset();

    reloadOnboarding.calls.reset();

    reloadBaby.calls.reset();

    ensureBabyLoaded.calls.reset();

    getIncompleteRoute.calls.reset();

    navigate.calls.reset();

    navigateByUrl.calls.reset();

    readInvite.and.resolveTo({
      id: token,

      babyId: 'baby-1',

      createdByUid: 'owner-user',

      createdAt: Date.now() - 1000,

      expiresAt: Date.now() + 60_000,

      status: 'pending',

      acceptedByUid: null,

      acceptedAt: null,
    });

    acceptInvite.and.resolveTo('baby-1');

    ensureLoaded.and.resolveTo();

    reloadOnboarding.and.resolveTo();

    reloadBaby.and.resolveTo();

    ensureBabyLoaded.and.resolveTo();

    getIncompleteRoute.and.returnValue('/home');

    navigate.and.resolveTo(true);

    navigateByUrl.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,

          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                token,
              }),
            },
          },
        },

        {
          provide: Router,

          useValue: {
            navigate,
            navigateByUrl,
          },
        },

        {
          provide: AuthService,

          useValue: {
            user: user.asReadonly(),

            isAuthenticated: () => user() !== null,

            waitUntilReady: jasmine.createSpy('waitUntilReady').and.resolveTo(),
          },
        },

        {
          provide: BabyInviteRepository,

          useValue: {
            readInvite,
            acceptInvite,
          },
        },

        {
          provide: OnboardingService,

          useValue: {
            ensureLoaded,

            reload: reloadOnboarding,

            getIncompleteRoute,
          },
        },

        {
          provide: BabyContextService,

          useValue: {
            ensureLoaded: ensureBabyLoaded,
            reload: reloadBaby,
          },
        },
      ],
    });

    page = TestBed.runInInjectionContext(() => new InvitePage());
  });

  it('pede autenticação sem consultar convite quando não existe sessão', async () => {
    user.set(null);

    await page.ngOnInit();

    expect(page.needsAuthentication()).toBeTrue();

    expect(readInvite).not.toHaveBeenCalled();
  });

  it('redireciona responsável sem dados pessoais preservando convite', async () => {
    getIncompleteRoute.and.returnValue('/onboarding/about-you');

    await page.ngOnInit();

    expect(navigate).toHaveBeenCalledOnceWith(['/onboarding/about-you'], {
      queryParams: {
        returnUrl: `/invite/${token}`,
      },
    });

    expect(readInvite).not.toHaveBeenCalled();
  });

  it('carrega convite pendente para usuário autenticado', async () => {
    await page.ngOnInit();

    expect(readInvite).toHaveBeenCalledOnceWith(token);

    expect(page.invite()?.id).toBe(token);

    expect(page.canAccept()).toBeTrue();
  });

  it('recusa convite expirado', async () => {
    readInvite.and.resolveTo({
      id: token,

      babyId: 'baby-1',

      createdByUid: 'owner-user',

      createdAt: Date.now() - 10_000,

      expiresAt: Date.now() - 1000,

      status: 'pending',

      acceptedByUid: null,

      acceptedAt: null,
    });

    await page.ngOnInit();

    expect(page.error()).toBe('Este convite expirou.');

    expect(page.canAccept()).toBeFalse();
  });

  it('migra bebê existente antes de aceitar outro convite', async () => {
    await page.ngOnInit();

    await page.accept();

    expect(ensureBabyLoaded).toHaveBeenCalledBefore(acceptInvite);
    expect(acceptInvite).toHaveBeenCalledOnceWith(token);
  });

  it('não tenta migrar bebê próprio quando a conta ainda não possui um', async () => {
    getIncompleteRoute.and.returnValue('/onboarding/about-baby');

    await page.ngOnInit();
    await page.accept();

    expect(ensureBabyLoaded).not.toHaveBeenCalled();
    expect(acceptInvite).toHaveBeenCalledOnceWith(token);
  });

  it('aceita convite e recarrega contexto compartilhado', async () => {
    await page.ngOnInit();

    await page.accept();

    expect(acceptInvite).toHaveBeenCalledOnceWith(token);

    expect(reloadBaby).toHaveBeenCalled();

    expect(reloadOnboarding).toHaveBeenCalled();

    expect(navigate).toHaveBeenCalledWith(['/home']);
  });
});
