import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  readonly caregiverName = signal('');
  readonly babyName = signal('');
  readonly babyBirthDate = signal('');

  setCaregiverName(name: string): void {
    this.caregiverName.set(name.trim());
  }

  setBabyData(name: string, birthDate: string): void {
    this.babyName.set(name.trim());
    this.babyBirthDate.set(birthDate);
  }
}