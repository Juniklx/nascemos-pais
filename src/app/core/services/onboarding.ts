import { Injectable, signal } from '@angular/core';

interface OnboardingData {
  caregiverName: string;
  babyName: string;
  babyBirthDate: string;
}

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly storageKey = 'nascemos-pais:onboarding';

  private readonly initialData = this.loadData();

  readonly caregiverName = signal(this.initialData.caregiverName);
  readonly babyName = signal(this.initialData.babyName);
  readonly babyBirthDate = signal(this.initialData.babyBirthDate);

  setCaregiverName(name: string): void {
    this.caregiverName.set(name.trim());

    this.saveData();
  }

  setBabyData(name: string, birthDate: string): void {
    this.babyName.set(name.trim());
    this.babyBirthDate.set(birthDate);

    this.saveData();
  }

  private saveData(): void {
    const data: OnboardingData = {
      caregiverName: this.caregiverName(),
      babyName: this.babyName(),
      babyBirthDate: this.babyBirthDate(),
    };

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(data),
    );
  }

  private loadData(): OnboardingData {
    const emptyData: OnboardingData = {
      caregiverName: '',
      babyName: '',
      babyBirthDate: '',
    };

    const savedData = localStorage.getItem(this.storageKey);

    if (!savedData) {
      return emptyData;
    }

    try {
      return {
        ...emptyData,
        ...JSON.parse(savedData),
      };
    } catch {
      return emptyData;
    }
  }
}