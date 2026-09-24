import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActivityPersistenceService } from '../../core/services/activity-persistence';
import { BabyContextService } from '../../core/services/baby-context';

@Component({
  selector: 'app-app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly persistence = inject(ActivityPersistenceService);
  private readonly babyContext = inject(BabyContextService);

  readonly linkedBabies = this.babyContext.linkedBabies;
  readonly activeBabyId = this.babyContext.activeBabyId;
  readonly babyName = computed(() => this.babyContext.baby()?.name ?? '');
  readonly contextError = this.babyContext.error;
  readonly realtimeStatus = this.persistence.realtimeStatus;
  readonly switchingBabyId = signal<string | null>(null);
  readonly switchError = signal('');

  retryRealtime(): void {
    this.persistence.retryRealtime();
  }

  async switchBaby(event: Event): Promise<void> {
    const target = event.target;

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const babyId = target.value;

    if (!babyId || babyId === this.activeBabyId() || this.switchingBabyId() !== null) {
      return;
    }

    this.switchingBabyId.set(babyId);
    this.switchError.set('');

    try {
      await this.babyContext.selectBaby(babyId);
      await this.persistence.load();
      await this.router.navigate(['/home']);
    } catch {
      this.switchError.set('Não foi possível trocar de bebê. Tente novamente.');
    } finally {
      this.switchingBabyId.set(null);
    }
  }
}
