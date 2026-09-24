import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OnboardingService } from '../../../core/services/onboarding';
import { normalizeInviteReturnUrl } from '../../../core/utils/invite-return-url';
import { trimmedRequired } from '../../../core/validators/onboarding.validators';

@Component({
  selector: 'app-about-you',

  imports: [ReactiveFormsModule, RouterLink],

  templateUrl: './about-you.html',

  styleUrl: './about-you.css',
})
export class AboutYou {
  private readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);

  private readonly onboarding = inject(OnboardingService);

  readonly isLoading = this.onboarding.isLoading;

  readonly storageError = this.onboarding.storageError;

  readonly returnUrl = normalizeInviteReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  readonly form = new FormGroup({
    name: new FormControl(this.onboarding.caregiverName(), {
      nonNullable: true,

      validators: [trimmedRequired],
    }),

    consent: new FormControl(this.onboarding.consentGiven(), {
      nonNullable: true,

      validators: [Validators.requiredTrue],
    }),
  });

  get name(): FormControl<string> {
    return this.form.controls.name;
  }

  get consent(): FormControl<boolean> {
    return this.form.controls.consent;
  }

  async continue(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const saved = await this.onboarding.setCaregiverName(this.name.value, this.consent.value);

    if (!saved) {
      return;
    }

    /*
     * Em um convite não pedimos para
     * cadastrar outro bebê.
     *
     * Voltamos diretamente ao convite,
     * que vinculará o bebê compartilhado.
     */
    if (this.returnUrl !== null) {
      await this.router.navigateByUrl(this.returnUrl);

      return;
    }

    await this.router.navigate(['/onboarding/about-baby']);
  }
}
