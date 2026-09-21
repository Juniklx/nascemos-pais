import { Routes } from '@angular/router';
import { onboardingCompleteGuard } from './core/guards/onboarding-complete.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/welcome/welcome').then(
        (m) => m.Welcome,
      ),
  },
  {
    path: 'onboarding/about-you',
    loadComponent: () =>
      import('./features/onboarding/about-you/about-you').then(
        (m) => m.AboutYou,
      ),
  },
  {
    path: 'onboarding/about-baby',
    loadComponent: () =>
      import('./features/onboarding/about-baby/about-baby').then(
        (m) => m.AboutBaby,
      ),
  },
  {
    path: '',
    canActivate: [
      authGuard,
      onboardingCompleteGuard,
    ],
    loadComponent: () =>
      import('./layouts/app-shell/app-shell').then(
        (m) => m.AppShell,
      ),
    children: [
      {
        path: 'profile',
        title: 'Perfil | Nascemos Pais',
        loadComponent: () =>
          import('./features/profile/profile').then(
            (m) => m.ProfilePage,
          ),
      },
      {
        path: 'home',
        title: 'Início | Nascemos Pais',
        loadComponent: () =>
          import('./features/home/home').then(
            (m) => m.Home,
          ),
      },
      {
        path: 'history',
        title: 'Histórico | Nascemos Pais',
        loadComponent: () =>
          import('./features/history/history').then(
            (m) => m.History,
          ),
      },
      {
        path: 'history/:type/:id',
        title: 'Detalhes do registro | Nascemos Pais',
        loadComponent: () =>
          import(
            './features/history/history-detail/history-detail'
          ).then((m) => m.HistoryDetail),
      },
      {
        path: 'routine',
        title: 'Rotina | Nascemos Pais',
        loadComponent: () =>
          import('./features/routine/routine').then(
            (m) => m.Routine,
          ),
      },
      {
        path: 'voice',
        title: 'Comando de voz | Nascemos Pais',
        loadComponent: () =>
          import('./features/voice/voice').then(
            (m) => m.VoicePage,
          ),
      },
      {
        path: 'diaper',
        title: 'Fralda | Nascemos Pais',
        loadComponent: () =>
          import('./features/diaper/diaper').then(
            (m) => m.DiaperPage,
          ),
      },
      {
        path: 'sleep',
        title: 'Sono | Nascemos Pais',
        loadComponent: () =>
          import('./features/sleep/sleep').then(
            (m) => m.SleepPage,
          ),
      },
      {
        path: 'feeding',
        title: 'Mamada | Nascemos Pais',
        loadComponent: () =>
          import('./features/feeding/feeding').then(
            (m) => m.FeedingPage,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];