import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { OnboardingService } from '../../../core/services/onboarding';

@Component({
  selector: 'app-about-you',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './about-you.html',
  styleUrl: './about-you.css',
})
export class AboutYou {
  private readonly router = inject(Router);
  private readonly onboarding = inject(OnboardingService);

  form = new FormGroup({
    name: new FormControl(this.onboarding.caregiverName(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get name(): FormControl<string> {
    return this.form.controls.name;
  }

  continue(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.onboarding.setCaregiverName(this.name.value);

    this.router.navigate(['/onboarding/about-baby']);
  }
}