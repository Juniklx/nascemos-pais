import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AccessRemovalService } from '../../core/services/access-removal';
import { OnboardingService } from '../../core/services/onboarding';

@Component({
  selector: 'app-access-removed',
  imports: [],
  templateUrl: './access-removed.html',
  styleUrl: './access-removed.css',
})
export class AccessRemovedPage implements OnInit {
  private readonly router = inject(Router);

  private readonly onboarding = inject(OnboardingService);

  readonly accessRemoval = inject(AccessRemovalService);

  readonly notification = this.accessRemoval.notification;

  readonly loading = this.accessRemoval.loading;

  readonly error = this.accessRemoval.error;

  async ngOnInit(): Promise<void> {
    await this.accessRemoval.load();

    if (!this.notification() && !this.error()) {
      await this.router.navigate(['/home']);
    }
  }

  async acknowledge(): Promise<void> {
    const acknowledged = await this.accessRemoval.acknowledge();

    if (!acknowledged) {
      return;
    }

    await this.router.navigate([this.onboarding.getIncompleteRoute()]);
  }
}