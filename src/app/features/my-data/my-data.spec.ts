import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { User } from 'firebase/auth';
import { AuthService } from '../../core/services/auth';
import { PrivacyDataExportService } from '../../core/services/privacy-data-export';
import { MyDataPage } from './my-data';

describe('MyDataPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyDataPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal({ uid: 'user-a' } as User).asReadonly() },
        },
        {
          provide: PrivacyDataExportService,
          useValue: { collect: jasmine.createSpy('collect') },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('oferece solicitacao por email sem prometer exclusao imediata', () => {
    const fixture = TestBed.createComponent(MyDataPage);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const email = page.querySelector<HTMLAnchorElement>(
      'a[href^="mailto:privacidade@nascemospais.com.br"]',
    );

    expect(email?.textContent).toContain('Solicitar exclusão por e-mail');
    expect(page.textContent).toContain('não exclui');
    expect(page.textContent).toContain('compartilha registros de um bebê');
  });
});
