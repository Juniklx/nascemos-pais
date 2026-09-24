import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { OnboardingService } from '../../../core/services/onboarding';
import { normalizeInviteReturnUrl } from '../../../core/utils/invite-return-url';

@Component({
  selector: 'app-register',

  imports: [ReactiveFormsModule, RouterLink],

  templateUrl: './register.html',

  styleUrl: '../auth.css',
})
export class RegisterPage {
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

      validators: [Validators.required, Validators.minLength(6)],
    }),

    confirmPassword: new FormControl('', {
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

  get confirmPassword(): FormControl<string> {
    return this.form.controls.confirmPassword;
  }

  get passwordsDoNotMatch(): boolean {
    return this.confirmPassword.touched && this.password.value !== this.confirmPassword.value;
  }

  clearError(): void {
    this.auth.clearError();
  }

  async submit(): Promise<void> {
    this.auth.clearError();

    if (this.form.invalid || this.password.value !== this.confirmPassword.value) {
      this.form.markAllAsTouched();

      return;
    }

    const success = await this.auth.register(this.email.value, this.password.value);

    if (!success) {
      return;
    }

    await this.goToAboutYou();
  }

  async continueWithGoogle(): Promise<void> {
    const success = await this.auth.loginWithGoogle();

    if (!success) {
      return;
    }

    await this.onboarding.ensureLoaded();

    if (this.returnUrl !== null) {
      const incompleteRoute = this.onboarding.getIncompleteRoute();

      if (incompleteRoute === '/onboarding/about-you') {
        await this.goToAboutYou();

        return;
      }

      await this.router.navigateByUrl(this.returnUrl);

      return;
    }

    await this.router.navigate([this.onboarding.getIncompleteRoute()]);
  }

  private async goToAboutYou(): Promise<void> {
    if (this.returnUrl === null) {
      await this.router.navigate(['/onboarding/about-you']);

      return;
    }

    await this.router.navigate(['/onboarding/about-you'], {
      queryParams: {
        returnUrl: this.returnUrl,
      },
    });
  }
}
