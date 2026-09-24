import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { routes } from '../../app.routes';
import { NotFoundPage } from './not-found';

describe('NotFoundPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('mostra uma mensagem de erro e um link para o início', () => {
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('h1')?.textContent).toContain('Não encontramos esta página');
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/');

    fixture.destroy();
  });

  it('impede indexação enquanto a página 404 está aberta', () => {
    const meta = TestBed.inject(Meta);
    const previousContent = meta.getTag('name="robots"')?.content ?? null;
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();

    expect(meta.getTag('name="robots"')?.content).toBe('noindex, follow');

    fixture.destroy();
    expect(meta.getTag('name="robots"')?.content ?? null).toBe(previousContent);
  });

  it('usa a página 404 na rota desconhecida', () => {
    const wildcard = routes.at(-1);
    expect(wildcard?.path).toBe('**');
    expect(wildcard?.title).toBe('Página não encontrada | Nascemos Pais');
    expect(wildcard?.redirectTo).toBeUndefined();
    expect(wildcard?.loadComponent).toEqual(jasmine.any(Function));
  });
});
