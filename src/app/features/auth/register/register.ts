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
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register.html',
  styleUrl: '../auth.css',
})
export class RegisterPage {
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
          Validators.minLength(6),
        ],
      },
    ),

    confirmPassword: new FormControl(
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

  get confirmPassword(): FormControl<string> {
    return this.form.controls.confirmPassword;
  }

  get passwordsDoNotMatch(): boolean {
    return (
      this.confirmPassword.touched &&
      this.password.value !==
      this.confirmPassword.value
    );
  }

  clearError(): void {
    this.auth.clearError();
  }

  async submit(): Promise<void> {
    this.auth.clearError();

    if (
      this.form.invalid ||
      this.password.value !==
      this.confirmPassword.value
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const success =
      await this.auth.register(
        this.email.value,
        this.password.value,
      );

    if (!success) {
      return;
    }

    await this.router.navigate([
      '/onboarding/about-you',
    ]);
  }

  async continueWithGoogle(): Promise<void> {
    const success =
      await this.auth.loginWithGoogle();

    if (!success) {
      return;
    }

    await this.onboarding
      .ensureLoaded();

    await this.router.navigate([
      this.onboarding.getIncompleteRoute(),
    ]);
  }
}