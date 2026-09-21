import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Router,
  RouterLink,
} from '@angular/router';

import {
  AuthService,
} from '../../../core/services/auth';
import {
  OnboardingService,
} from '../../../core/services/onboarding';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: '../auth.css',
})
export class LoginPage {
  private readonly router =
    inject(Router);

  private readonly onboarding =
    inject(OnboardingService);

  readonly auth =
    inject(AuthService);

  readonly form = new FormGroup({
    email: new FormControl(
      '',
      {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
        ],
      },
    ),

    password: new FormControl(
      '',
      {
        nonNullable: true,
        validators: [
          Validators.required,
        ],
      },
    ),
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

    const success =
      await this.auth.login(
        this.email.value,
        this.password.value,
      );

    if (!success) {
      return;
    }

    await this.goAfterAuthentication();
  }

  async continueWithGoogle(): Promise<void> {
    const success =
      await this.auth.loginWithGoogle();

    if (!success) {
      return;
    }

    await this.goAfterAuthentication();
  }

  private async goAfterAuthentication():
  Promise<void> {
  await this.onboarding
    .ensureLoaded();

  await this.router.navigate([
    this.onboarding
      .getIncompleteRoute(),
  ]);
}
}