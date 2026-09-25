import {
  Component,
  DestroyRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

interface WelcomeSlide {
  title: string;
  description: string;
  type: 'voice' | 'timeline' | 'quick';
}

@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly slides: readonly WelcomeSlide[] = [
    {
      title: 'Registre com a voz',
      description:
        'Use comandos de voz para iniciar registros de amamentação, sono e troca de fralda quando suas mãos estiverem ocupadas.',
      type: 'voice',
    },
    {
      title: 'Acompanhe a rotina',
      description:
        'Veja amamentações, sono e trocas organizados em uma linha do tempo para consultar o que aconteceu ao longo do dia.',
      type: 'timeline',
    },
    {
      title: 'Registre em poucos passos',
      description:
        'Acesse rapidamente amamentação, sono e fralda e mantenha os registros do dia organizados.',
      type: 'quick',
    },
  ];

  readonly activeIndex = signal(0);
  readonly isPaused = signal(false);
  readonly isTextTransitioning = signal(false);

  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private textTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly autoplayDelay = 6000;

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    afterNextRender(() => {
      void this.redirectAuthenticatedVisitor();
    });

    if (this.prefersReducedMotion) {
      this.isPaused.set(true);
      return;
    }

    this.startAutoplay();
  }

  private async redirectAuthenticatedVisitor(): Promise<void> {
    const { AuthService } = await import('../../core/services/auth');
    if (this.destroyRef.destroyed || !this.isWelcomeRoute()) return;

    const auth = this.injector.get(AuthService);
    await auth.waitUntilReady();
    if (this.destroyRef.destroyed || !this.isWelcomeRoute() || !auth.isAuthenticated()) return;

    const { OnboardingService } = await import('../../core/services/onboarding');
    const onboarding = this.injector.get(OnboardingService);
    await onboarding.ensureLoaded();
    if (this.destroyRef.destroyed || !this.isWelcomeRoute()) return;

    await this.router.navigate([onboarding.getIncompleteRoute()], { replaceUrl: true });
  }

  private isWelcomeRoute(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/';
  }

  get activeSlide(): WelcomeSlide {
    return this.slides[this.activeIndex()];
  }

  previous(): void {
    const current = this.activeIndex();

    const target = current === 0 ? this.slides.length - 1 : current - 1;

    this.changeSlide(target);
    this.restartAutoplay();
  }

  next(): void {
    const current = this.activeIndex();

    const target = current === this.slides.length - 1 ? 0 : current + 1;

    this.changeSlide(target);
    this.restartAutoplay();
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.slides.length) {
      return;
    }

    this.changeSlide(index);
    this.restartAutoplay();
  }

  toggleAutoplay(): void {
    if (this.isPaused()) {
      this.isPaused.set(false);
      this.startAutoplay();
      return;
    }

    this.isPaused.set(true);
    this.stopAutoplay();
  }

  onCarouselKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.previous();
        break;

      case 'ArrowRight':
        event.preventDefault();
        this.next();
        break;

      case 'Home':
        event.preventDefault();
        this.goTo(0);
        break;

      case 'End':
        event.preventDefault();
        this.goTo(this.slides.length - 1);
        break;
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();

    if (this.textTransitionTimer !== null) {
      clearTimeout(this.textTransitionTimer);
      this.textTransitionTimer = null;
    }
  }

  private changeSlide(index: number): void {
    if (index === this.activeIndex() || this.isTextTransitioning()) {
      return;
    }

    if (this.prefersReducedMotion) {
      this.activeIndex.set(index);
      return;
    }

    this.isTextTransitioning.set(true);

    this.textTransitionTimer = setTimeout(() => {
      this.activeIndex.set(index);

      this.isTextTransitioning.set(false);

      this.textTransitionTimer = null;
    }, 180);
  }

  private startAutoplay(): void {
    this.stopAutoplay();

    this.autoplayTimer = setInterval(() => {
      const nextIndex = (this.activeIndex() + 1) % this.slides.length;

      this.changeSlide(nextIndex);
    }, this.autoplayDelay);
  }

  private stopAutoplay(): void {
    if (this.autoplayTimer === null) {
      return;
    }

    clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
  }

  private restartAutoplay(): void {
    if (this.isPaused()) {
      return;
    }

    this.startAutoplay();
  }
}
