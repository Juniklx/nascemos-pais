import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OnboardingService } from '../../../core/services/onboarding';
import {
  trimmedRequired,
  validBirthDate,
} from '../../../core/validators/onboarding.validators';

@Component({
  selector: 'app-about-baby',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './about-baby.html',
  styleUrl: './about-baby.css',
})
export class AboutBaby {
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  readonly storageError =
    this.onboarding.storageError;
  readonly today = this.getToday();

  form = new FormGroup({
    babyName: new FormControl(this.onboarding.babyName(), {
      nonNullable: true,
      validators: [trimmedRequired],
    }),

    birthDate: new FormControl(this.onboarding.babyBirthDate(), {
      nonNullable: true,
      validators: [
        Validators.required,
        validBirthDate,
      ],
    }),
  });

  get babyName(): FormControl<string> {
    return this.form.controls.babyName;
  }

  get birthDate(): FormControl<string> {
    return this.form.controls.birthDate;
  }

  finish(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.onboarding.setBabyData(
      this.babyName.value,
      this.birthDate.value,
    );

    this.router.navigate(['/home']);
  }

  babyAge(): string {
    if (this.birthDate.invalid || !this.birthDate.value) {
      return '';
    }

    const birthDate = new Date(`${this.birthDate.value}T00:00:00`);
    const today = new Date();

    let months =
      (today.getFullYear() - birthDate.getFullYear()) * 12 +
      today.getMonth() -
      birthDate.getMonth();

    if (today.getDate() < birthDate.getDate()) {
      months--;
    }

    if (months < 0) {
      return '';
    }

    if (months === 0) {
      const milliseconds = today.getTime() - birthDate.getTime();

      const days = Math.max(
        0,
        Math.floor(milliseconds / (1000 * 60 * 60 * 24)),
      );

      if (days === 1) {
        return '1 dia';
      }

      return `${days} dias`;
    }

    if (months === 1) {
      return '1 mês';
    }

    if (months < 24) {
      return `${months} meses`;
    }

    const years = Math.floor(months / 12);

    if (years === 1) {
      return '1 ano';
    }

    return `${years} anos`;
  }

  private getToday(): string {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  
}