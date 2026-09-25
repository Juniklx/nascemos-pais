import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { from, isObservable, switchMap } from 'rxjs';

const lazyGuard =
  (load: () => Promise<CanActivateFn>): CanActivateFn =>
  (route, state) => {
    const injector = inject(EnvironmentInjector);
    return from(load()).pipe(
      switchMap((guard) => {
        const result = runInInjectionContext(injector, () => guard(route, state));
        return isObservable(result) ? result : from(Promise.resolve(result));
      }),
    );
  };

const activityReadyGuard = lazyGuard(() =>
  import('./core/guards/activity-ready.guard').then((m) => m.activityReadyGuard),
);
const authGuard = lazyGuard(() => import('./core/guards/auth.guard').then((m) => m.authGuard));
const guestGuard = lazyGuard(() => import('./core/guards/guest.guard').then((m) => m.guestGuard));
const onboardingCompleteGuard = lazyGuard(() =>
  import('./core/guards/onboarding-complete.guard').then((m) => m.onboardingCompleteGuard),
);
const onboardingReadyGuard = lazyGuard(() =>
  import('./core/guards/onboarding-ready.guard').then((m) => m.onboardingReadyGuard),
);
const accessRemovalGuard = lazyGuard(() =>
  import('./core/guards/access-removal.guard').then((m) => m.accessRemovalGuard),
);

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'auth/login',

    canActivate: [guestGuard],

    title: 'Entrar | Nascemos Pais',

    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'auth/register',

    canActivate: [guestGuard],

    title: 'Criar conta | Nascemos Pais',

    loadComponent: () => import('./features/auth/register/register').then((m) => m.RegisterPage),
  },
  {
    path: 'privacidade',
    title: 'Política de Privacidade | Nascemos Pais',
    loadComponent: () =>
      import('./features/privacy/privacy-policy').then((m) => m.PrivacyPolicyPage),
  },
  {
    path: 'termos',
    title: 'Termos de Uso | Nascemos Pais',
    loadComponent: () => import('./features/terms/terms-of-use').then((m) => m.TermsOfUsePage),
  },
  {
    path: 'invite/:token',

    title: 'Convite | Nascemos Pais',

    loadComponent: () => import('./features/invite/invite').then((m) => m.InvitePage),
  },
  {
    path: 'access-removed',

    canActivate: [authGuard],

    title: 'Acesso removido | Nascemos Pais',

    loadComponent: () =>
      import('./features/access-removed/access-removed').then((m) => m.AccessRemovedPage),
  },
  {
    path: 'onboarding/about-you',

    canActivate: [authGuard, accessRemovalGuard, onboardingReadyGuard],

    loadComponent: () =>
      import('./features/onboarding/about-you/about-you').then((m) => m.AboutYou),
  },
  {
    path: 'onboarding/about-baby',

    canActivate: [authGuard, accessRemovalGuard, onboardingReadyGuard],

    loadComponent: () =>
      import('./features/onboarding/about-baby/about-baby').then((m) => m.AboutBaby),
  },
  {
    path: '',

    canActivate: [authGuard, accessRemovalGuard, onboardingCompleteGuard, activityReadyGuard],

    loadComponent: () => import('./layouts/app-shell/app-shell').then((m) => m.AppShell),

    children: [
      {
        path: 'meus-dados',
        title: 'Meus dados | Nascemos Pais',
        loadComponent: () => import('./features/my-data/my-data').then((m) => m.MyDataPage),
      },
      {
        path: 'profile',

        title: 'Perfil | Nascemos Pais',

        loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage),
      },
      {
        path: 'home',

        title: 'Início | Nascemos Pais',

        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'history',

        title: 'Histórico | Nascemos Pais',

        loadComponent: () => import('./features/history/history').then((m) => m.History),
      },
      {
        path: 'history/:type/:id',

        title: 'Detalhes do registro | Nascemos Pais',

        loadComponent: () =>
          import('./features/history/history-detail/history-detail').then((m) => m.HistoryDetail),
      },
      {
        path: 'routine',

        title: 'Rotina | Nascemos Pais',

        loadComponent: () => import('./features/routine/routine').then((m) => m.Routine),
      },
      {
        path: 'voice',

        title: 'Comando de voz | Nascemos Pais',

        loadComponent: () => import('./features/voice/voice').then((m) => m.VoicePage),
      },
      {
        path: 'diaper',

        title: 'Fralda | Nascemos Pais',

        loadComponent: () => import('./features/diaper/diaper').then((m) => m.DiaperPage),
      },
      {
        path: 'sleep',

        title: 'Sono | Nascemos Pais',

        loadComponent: () => import('./features/sleep/sleep').then((m) => m.SleepPage),
      },
      {
        path: 'feeding',

        title: 'Amamentação | Nascemos Pais',

        loadComponent: () => import('./features/feeding/feeding').then((m) => m.FeedingPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Página não encontrada | Nascemos Pais',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFoundPage),
  },
];
