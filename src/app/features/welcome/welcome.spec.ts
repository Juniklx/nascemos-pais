import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Welcome } from './welcome';

describe('Welcome: carrossel', () => {
  let fixture: ComponentFixture<Welcome>;
  let component: Welcome;
  let matchMediaSpy: jasmine.Spy;

  const transitionDuration = 180;
  const autoplayDelay = 6000;

  const createMediaQueryList = (
    matches: boolean,
  ): MediaQueryList =>
    ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

  const createComponent = (): void => {
    fixture = TestBed.createComponent(Welcome);
    component = fixture.componentInstance;

    fixture.detectChanges();
  };

  const finishTransition = (): void => {
    jasmine.clock().tick(transitionDuration);

    fixture.detectChanges();
  };

  beforeEach(async () => {
    jasmine.clock().install();

    matchMediaSpy = spyOn(
      window,
      'matchMedia',
    ).and.returnValue(
      createMediaQueryList(false),
    );

    await TestBed.configureTestingModule({
      imports: [Welcome],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();

    jasmine.clock().uninstall();
  });

  it('possui três recursos no carrossel', () => {
    createComponent();

    expect(component.slides.length).toBe(3);

    expect(
      component.activeIndex(),
    ).toBe(0);

    expect(
      component.activeSlide.title,
    ).toBe('Registre com a voz');
  });

  it('avança e retorna ao primeiro slide após o último', () => {
    createComponent();

    component.next();
    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(1);

    component.next();
    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(2);

    component.next();
    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(0);
  });

  it('volta para o último slide a partir do primeiro', () => {
    createComponent();

    component.previous();

    expect(
      component.isTextTransitioning(),
    ).toBeTrue();

    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(2);

    expect(
      component.activeSlide.title,
    ).toBe('Registre em poucos passos');
  });

  it('permite selecionar um slide pelos indicadores', () => {
    createComponent();

    const dots =
      fixture.nativeElement.querySelectorAll(
        '.carousel__dot-button',
      ) as NodeListOf<HTMLButtonElement>;

    expect(dots.length).toBe(3);

    dots[1].click();

    expect(
      component.isTextTransitioning(),
    ).toBeTrue();

    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(1);

    expect(
      component.activeSlide.title,
    ).toBe('Acompanhe a rotina');

    expect(
      dots[1].getAttribute('aria-current'),
    ).toBe('true');
  });

  it('navega pelas setas do teclado', () => {
    createComponent();

    component.onCarouselKeydown(
      new KeyboardEvent(
        'keydown',
        {
          key: 'ArrowRight',
          cancelable: true,
        },
      ),
    );

    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(1);

    component.onCarouselKeydown(
      new KeyboardEvent(
        'keydown',
        {
          key: 'ArrowLeft',
          cancelable: true,
        },
      ),
    );

    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(0);
  });

  it('navega para o início e o fim pelo teclado', () => {
    createComponent();

    component.onCarouselKeydown(
      new KeyboardEvent(
        'keydown',
        {
          key: 'End',
          cancelable: true,
        },
      ),
    );

    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(2);

    component.onCarouselKeydown(
      new KeyboardEvent(
        'keydown',
        {
          key: 'Home',
          cancelable: true,
        },
      ),
    );

    finishTransition();

    expect(
      component.activeIndex(),
    ).toBe(0);
  });

  it('aplica fade antes de trocar o conteúdo do slide', () => {
    createComponent();

    component.next();

    fixture.detectChanges();

    expect(
      component.isTextTransitioning(),
    ).toBeTrue();

    expect(
      component.activeIndex(),
    ).toBe(0);

    const text =
      fixture.nativeElement.querySelector(
        '.carousel__text',
      ) as HTMLElement;

    expect(
      text.classList.contains(
        'carousel__text--hidden',
      ),
    ).toBeTrue();

    jasmine.clock().tick(
      transitionDuration - 1,
    );

    expect(
      component.activeIndex(),
    ).toBe(0);

    jasmine.clock().tick(1);

    fixture.detectChanges();

    expect(
      component.activeIndex(),
    ).toBe(1);

    expect(
      component.isTextTransitioning(),
    ).toBeFalse();

    expect(
      text.classList.contains(
        'carousel__text--hidden',
      ),
    ).toBeFalse();
  });

  it('avança automaticamente após seis segundos', () => {
  createComponent();

  expect(
    component.activeIndex(),
  ).toBe(0);

  jasmine.clock().tick(
    autoplayDelay + transitionDuration,
  );

  expect(
    component.activeIndex(),
  ).toBe(1);

  jasmine.clock().tick(
    autoplayDelay,
  );

  jasmine.clock().tick(
    transitionDuration,
  );

  expect(
    component.activeIndex(),
  ).toBe(2);

  jasmine.clock().tick(
    autoplayDelay,
  );

  jasmine.clock().tick(
    transitionDuration,
  );

  expect(
    component.activeIndex(),
  ).toBe(0);
});

  it('permite pausar e reproduzir novamente o carrossel', () => {
    createComponent();

    component.toggleAutoplay();

    expect(
      component.isPaused(),
    ).toBeTrue();

    jasmine.clock().tick(12000);

    expect(
      component.activeIndex(),
    ).toBe(0);

    fixture.detectChanges();

    const button =
      fixture.nativeElement.querySelector(
        '.carousel__autoplay',
      ) as HTMLButtonElement;

    expect(
      button.textContent?.trim(),
    ).toContain('Reproduzir');

    component.toggleAutoplay();

    expect(
      component.isPaused(),
    ).toBeFalse();

    jasmine.clock().tick(
      autoplayDelay,
    );

    jasmine.clock().tick(
      transitionDuration,
    );

    expect(
      component.activeIndex(),
    ).toBe(1);
  });

  it('inicia pausado e sem animação quando movimento reduzido está ativado', () => {
    matchMediaSpy.and.returnValue(
      createMediaQueryList(true),
    );

    createComponent();

    expect(
      component.isPaused(),
    ).toBeTrue();

    jasmine.clock().tick(12000);

    expect(
      component.activeIndex(),
    ).toBe(0);

    component.next();

    expect(
      component.activeIndex(),
    ).toBe(1);

    expect(
      component.isTextTransitioning(),
    ).toBeFalse();
  });
});