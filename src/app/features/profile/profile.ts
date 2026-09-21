import { Component, inject, signal } from '@angular/core';
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
import { ThemeService } from '../../core/services/theme';
import { OnboardingService } from '../../core/services/onboarding';
import {
  trimmedRequired,
  validBirthDate,
} from '../../core/validators/onboarding.validators';
import {
  AuthService,
} from '../../core/services/auth';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfilePage {
  private readonly onboarding =
    inject(OnboardingService);

  private readonly router =
    inject(Router);

  readonly auth =
    inject(AuthService);

  readonly theme =
    inject(ThemeService);

  readonly storageError =
    this.onboarding.storageError;

  readonly message =
    signal('');

  readonly fields = [
    {
      key: 'caregiverName',
      label: 'Seu nome',
      type: 'text',
      autocomplete: 'name',
      error: 'Informe seu nome. Não use apenas espaços.',
    },
    {
      key: 'babyName',
      label: 'Nome do bebê',
      type: 'text',
      autocomplete: 'off',
      error: 'Informe o nome do bebê. Não use apenas espaços.',
    },
    {
      key: 'babyBirthDate',
      label: 'Data de nascimento',
      type: 'date',
      autocomplete: 'off',
      error: 'Informe uma data válida, que não esteja no futuro.',
    },
  ] as const;

  readonly form = new FormGroup({
    caregiverName: new FormControl(
      this.onboarding.caregiverName(),
      {
        nonNullable: true,
        validators: [trimmedRequired],
      },
    ),
    babyName: new FormControl(
      this.onboarding.babyName(),
      {
        nonNullable: true,
        validators: [trimmedRequired],
      },
    ),
    babyBirthDate: new FormControl(
      this.onboarding.babyBirthDate(),
      {
        nonNullable: true,
        validators: [Validators.required, validBirthDate],
      },
    ),
  });

  get today(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  clearMessage(): void {
    this.message.set('');
  }

  save(): void {
    this.message.set('');
    this.form.updateValueAndValidity();
    this.form.controls.babyBirthDate.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    const data = {
      caregiverName: values.caregiverName.trim(),
      babyName: values.babyName.trim(),
      babyBirthDate: values.babyBirthDate,
    };

    const saved = this.onboarding.updateProfile(data);

    if (!saved) {
      this.message.set(
        this.storageError()
          ? 'Os dados foram atualizados apenas nesta sessão e podem ser perdidos ao fechar a página.'
          : 'Não foi possível atualizar o perfil. Confira os campos.',
      );
      return;
    }

    this.form.reset(data);
    this.message.set('Perfil salvo com sucesso.');
  }

  async logout(): Promise<void> {
    const success =
      await this.auth.logout();

    if (!success) {
      return;
    }

    await this.router.navigate([
      '/auth/login',
    ]);
  }
}