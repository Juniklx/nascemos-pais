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

  it('mantém aviso de revisão mesmo com contato definido', () => {
    const fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();

    const notice = (fixture.nativeElement as HTMLElement).querySelector('.privacy__notice');

    expect(notice?.textContent).toContain('Documento em revisão');
    expect(notice?.textContent).toContain('bases legais específicas');
  });
});
