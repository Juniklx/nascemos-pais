import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { User } from 'firebase/auth';
import { AccountDeletionPreflightService } from '../../core/services/account-deletion-preflight';
import { AuthService } from '../../core/services/auth';
import { PrivacyDataExportService } from '../../core/services/privacy-data-export';
import { MyDataPage } from './my-data';

describe('MyDataPage', () => {
  let preview: jasmine.Spy;
  beforeEach(async () => {
    preview = jasmine.createSpy('preview').and.resolveTo({
      babies: [{ id: 'baby-a', name: 'Bebê A', role: 'owner', otherCaregivers: 1 }],
      requiresOwnerDecision: true,
    });
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
        {
          provide: AccountDeletionPreflightService,
          useValue: { preview },
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
  it('mostra o impacto sobre bebês compartilhados após consultar o servidor', async () => {
    const fixture = TestBed.createComponent(MyDataPage);
    fixture.detectChanges();

    await fixture.componentInstance.checkDeletion();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;

    expect(preview).toHaveBeenCalledTimes(1);
    expect(page.textContent).toContain('Bebê A');
    expect(page.textContent).toContain('Você é proprietário');
    expect(page.textContent).toContain('transferência da propriedade');
    expect(page.textContent).toContain('não substitui a verificação');
  });

});
