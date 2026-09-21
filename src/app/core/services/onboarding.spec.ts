import { TestBed } from '@angular/core/testing';

import { OnboardingService } from './onboarding';

describe('OnboardingService: consentimento', () => {
  const storageKey = 'nascemos-pais:onboarding';

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();

    TestBed.resetTestingModule();
  });

  it('não considera o onboarding completo sem consentimento', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        caregiverName: 'Marcelo',
        babyName: 'Bebê',
        babyBirthDate: '2026-01-01',
        consentGiven: false,
        consentAt: null,
      }),
    );

    const service = TestBed.inject(
      OnboardingService,
    );

    expect(service.isComplete()).toBeFalse();

    expect(
      service.getIncompleteRoute(),
    ).toBe('/onboarding/about-you');
  });

  it('registra consentimento com data e hora', () => {
    const service = TestBed.inject(
      OnboardingService,
    );

    const saved = service.setCaregiverName(
      'Marcelo',
      true,
    );

    expect(saved).toBeTrue();

    expect(
      service.consentGiven(),
    ).toBeTrue();

    expect(
      service.consentAt(),
    ).not.toBeNull();

    const parsedDate = Date.parse(
      service.consentAt()!,
    );

    expect(
      Number.isNaN(parsedDate),
    ).toBeFalse();
  });

  it('não aceita cadastro do responsável sem consentimento', () => {
    const service = TestBed.inject(
      OnboardingService,
    );

    const saved = service.setCaregiverName(
      'Marcelo',
      false,
    );

    expect(saved).toBeFalse();

    expect(
      service.consentGiven(),
    ).toBeFalse();

    expect(
      service.consentAt(),
    ).toBeNull();
  });

  it('persiste o consentimento no localStorage', () => {
    const service = TestBed.inject(
      OnboardingService,
    );

    service.setCaregiverName(
      'Marcelo',
      true,
    );

    const raw =
      localStorage.getItem(storageKey);

    expect(raw).not.toBeNull();

    const stored = JSON.parse(raw!);

    expect(
      stored.consentGiven,
    ).toBeTrue();

    expect(
      typeof stored.consentAt,
    ).toBe('string');
  });

  it('mantém compatibilidade com cadastro antigo sem consentimento', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        caregiverName: 'Marcelo',
        babyName: 'Bebê',
        babyBirthDate: '2026-01-01',
      }),
    );

    const service = TestBed.inject(
      OnboardingService,
    );

    expect(
      service.caregiverName(),
    ).toBe('Marcelo');

    expect(
      service.babyName(),
    ).toBe('Bebê');

    expect(
      service.consentGiven(),
    ).toBeFalse();

    expect(
      service.consentAt(),
    ).toBeNull();

    expect(
      service.getIncompleteRoute(),
    ).toBe('/onboarding/about-you');
  });

  it('preserva a data original ao salvar novamente', () => {
    const service = TestBed.inject(
      OnboardingService,
    );

    service.setCaregiverName(
      'Marcelo',
      true,
    );

    const firstConsentAt =
      service.consentAt();

    service.setCaregiverName(
      'Marcelo Soares',
      true,
    );

    expect(
      service.consentAt(),
    ).toBe(firstConsentAt);
  });

  it('considera o onboarding completo quando todos os dados e o consentimento são válidos', () => {
    const service = TestBed.inject(
      OnboardingService,
    );

    service.setCaregiverName(
      'Marcelo',
      true,
    );

    service.setBabyData(
      'Bebê',
      '2026-01-01',
    );

    expect(
      service.isComplete(),
    ).toBeTrue();

    expect(
      service.getIncompleteRoute(),
    ).toBe('/home');
  });
});