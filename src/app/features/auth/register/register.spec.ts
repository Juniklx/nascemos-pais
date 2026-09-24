import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { OnboardingService } from '../../../core/services/onboarding';
import { RegisterPage } from './register';

describe('RegisterPage: erros acessíveis', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { error: () => null, isLoading: () => false, clearError: () => {} },
        },
        { provide: OnboardingService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('associa cada erro de campo ao input após tentativa de cadastro', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    for (const id of ['register-email', 'register-password', 'confirm-password']) {
      const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
      const errorId = input.getAttribute('aria-describedby');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(errorId).toBeTruthy();
      expect(fixture.nativeElement.querySelector(`#${errorId}`)?.textContent.trim()).toBeTruthy();
    }

    fixture.destroy();
  });

  it('associa o erro de senhas diferentes ao campo de confirmação', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    const page = fixture.componentInstance;
    page.password.setValue('senha123');
    page.confirmPassword.setValue('outra123');
    page.confirmPassword.markAsTouched();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#confirm-password') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('confirm-password-error');
    expect(fixture.nativeElement.querySelector('#confirm-password-error')?.textContent).toContain('não são iguais');

    fixture.destroy();
  });
});
