import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'nascemos-pais-theme';
  private readonly currentTheme = signal<Theme>('light');

  readonly isDark = computed(() => this.currentTheme() === 'dark');
  readonly storageError = signal('');

  constructor() {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(
        this.storageKey,
      );

      if (saved === 'light' || saved === 'dark') {
        this.currentTheme.set(saved);
      }
    } catch {
      this.storageError.set(
        'Não foi possível recuperar sua preferência de tema.',
      );
    }

    this.applyTheme();
  }

  toggle(): void {
    this.currentTheme.update((theme) =>
      theme === 'light' ? 'dark' : 'light',
    );

    this.applyTheme();
    this.storageError.set('');

    try {
      const storage = this.document.defaultView?.localStorage;

      if (!storage) {
        throw new Error('Armazenamento indisponível');
      }

      storage.setItem(this.storageKey, this.currentTheme());
    } catch {
      this.storageError.set(
        'O tema foi alterado nesta sessão, mas não foi possível salvar sua preferência.',
      );
    }
  }

  private applyTheme(): void {
    this.document.documentElement.setAttribute(
      'data-theme',
      this.currentTheme(),
    );
  }
}