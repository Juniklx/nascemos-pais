import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyPolicyPage } from './privacy-policy';

describe('PrivacyPolicyPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicyPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('identifica o controlador e oferece contato de privacidade', () => {
    const fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const controller = page.querySelector('#responsavel');
    const email = page.querySelector<HTMLAnchorElement>(
      '#contato a[href="mailto:privacidade@nascemospais.com.br"]',
    );

    expect(controller?.textContent).toContain('Marcelo Soares Teixeira Junior');
    expect(email?.textContent).toContain('privacidade@nascemospais.com.br');
  });

  it('distingue localizacao do Firestore do processamento por outros servicos', () => {
    const fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();

    const sharing = (fixture.nativeElement as HTMLElement).querySelector('#compartilhamento');

    expect(sharing?.textContent).toContain('southamerica-east1');
    expect(sharing?.textContent).toContain('São Paulo');
    expect(sharing?.textContent).toContain('Estados Unidos');
    expect(sharing?.textContent).toContain('transferências internacionais');
  });

  it('informa exclusao por solicitacao e limites da retencao', () => {
    const fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();

    const retention = (fixture.nativeElement as HTMLElement).querySelector('#retencao');
    const emailLink = retention?.querySelector<HTMLAnchorElement>(
      'a[href^="mailto:privacidade@nascemospais.com.br"]',
    );

    expect(retention?.textContent).toContain('não prevê a exclusão automática');
    expect(retention?.textContent).toContain('conservação indefinida');
    expect(retention?.textContent).toContain('bebê compartilhado');
    expect(retention?.textContent).toContain('ainda depende de definição e revisão jurídica');
    expect(emailLink).not.toBeNull();
  });

  it('mantém aviso de revisão mesmo com contato definido', () => {
    const fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();

    const notice = (fixture.nativeElement as HTMLElement).querySelector('.privacy__notice');

    expect(notice?.textContent).toContain('Documento em revisão');
    expect(notice?.textContent).toContain('bases legais específicas');
  });
});
