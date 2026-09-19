import {
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

export function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidBirthDate(
  value: unknown,
  today = new Date(),
): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);

  // Impede que datas como 31/02 sejam convertidas para março.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  return date.getTime() <= endOfToday.getTime();
}

export function trimmedRequired(
  control: AbstractControl,
): ValidationErrors | null {
  return isValidName(control.value)
    ? null
    : { required: true };
}

export function validBirthDate(
  control: AbstractControl,
): ValidationErrors | null {
  if (control.value === '' || control.value === null) {
    return null; // Validators.required trata o campo vazio.
  }

  return isValidBirthDate(control.value)
    ? null
    : { invalidBirthDate: true };
}