import { Component, inject } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import { OnboardingService } from '../../core/services/onboarding';

@Component({
  selector: 'app-app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  private readonly onboarding = inject(OnboardingService);

  readonly babyName = this.onboarding.babyName;
}