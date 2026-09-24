import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { OnboardingService } from '../../../core/services/onboarding';
import { normalizeInviteReturnUrl } from '../../../core/utils/invite-return-url';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth.css',
})
export class LoginPage {
  private readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);

  private readonly onboarding = inject(OnboardingService);

  readonly auth = inject(AuthService);

  readonly returnUrl = normalizeInviteReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,

      validators: [Validators.required, Validators.email],
    }),

    password: new FormControl('', {
      nonNullable: true,

      validators: [Validators.required],
    }),
  });

  get email(): FormControl<string> {
    return this.form.controls.email;
  }

  get password(): FormControl<string> {
    return this.form.controls.password;
  }

  clearError(): void {
    this.auth.clearError();
  }

  async submit(): Promise<void> {
    this.auth.clearError();

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const success = await this.auth.login(this.email.value, this.password.value);

    if (!success) {
      return;
    }

    await this.goAfterAuthentication();
  }

  async continueWithGoogle(): Promise<void> {
    const success = await this.auth.loginWithGoogle();

    if (!success) {
      return;
    }

    await this.goAfterAuthentication();
  }

  private async goAfterAuthentication(): Promise<void> {
    await this.onboarding.ensureLoaded();

    if (this.returnUrl !== null) {
      const incompleteRoute = this.onboarding.getIncompleteRoute();

      /*
       * O responsável precisa ao menos
       * informar seu nome e consentir
       * com o tratamento dos dados antes
       * de aceitar o convite.
       *
       * Os dados do bebê serão obtidos
       * através do próprio convite.
       */
      if (incompleteRoute === '/onboarding/about-you') {
        await this.router.navigate(['/onboarding/about-you'], {
          queryParams: {
            returnUrl: this.returnUrl,
          },
        });

        return;
      }

      await this.router.navigateByUrl(this.returnUrl);

      return;
    }

    await this.router.navigate([this.onboarding.getIncompleteRoute()]);
  }
}
