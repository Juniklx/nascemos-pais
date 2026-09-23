import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { BabyInvite } from '../../core/models/baby-invite';
import { AuthService } from '../../core/services/auth';
import { BabyContextService } from '../../core/services/baby-context';
import { BabyInviteRepository } from '../../core/services/baby-invite.repository';
import { OnboardingService } from '../../core/services/onboarding';
import { normalizeInviteReturnUrl } from '../../core/utils/invite-return-url';

@Component({
  selector: 'app-invite',

  imports: [RouterLink],

  templateUrl: './invite.html',

  styleUrl: './invite.css',
})
export class InvitePage implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly invites = inject(BabyInviteRepository);

  private readonly babyContext = inject(BabyContextService);

  private readonly onboarding = inject(OnboardingService);

  readonly auth = inject(AuthService);

  readonly loading = signal(true);

  readonly accepting = signal(false);

  readonly error = signal('');

  readonly needsAuthentication = signal(false);

  readonly invite = signal<BabyInvite | null>(null);

  readonly token = (this.route.snapshot.paramMap.get('token') ?? '').trim();

  readonly returnUrl = normalizeInviteReturnUrl(`/invite/${this.token}`);

  readonly canAccept = computed(
    () =>
      this.invite()?.status === 'pending' && !this.loading() && !this.accepting() && !this.error(),
  );

  async ngOnInit(): Promise<void> {
    if (this.returnUrl === null) {
      this.error.set('Este link de convite é inválido.');

      this.loading.set(false);

      return;
    }

    try {
      await this.auth.waitUntilReady();

      if (!this.auth.isAuthenticated()) {
        this.needsAuthentication.set(true);

        return;
      }

      await this.onboarding.ensureLoaded();

      /*
       * Para aceitar um convite,
       * precisamos apenas dos dados
       * do responsável e do consentimento.
       *
       * O nome e a data do bebê serão
       * obtidos do bebê compartilhado.
       */
      if (this.onboarding.getIncompleteRoute() === '/onboarding/about-you') {
        await this.router.navigate(['/onboarding/about-you'], {
          queryParams: {
            returnUrl: this.returnUrl,
          },
        });

        return;
      }

      await this.loadInvite();
    } catch {
      this.error.set('Não foi possível carregar este convite. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }

  async accept(): Promise<void> {
    const invite = this.invite();

    if (invite === null || !this.canAccept()) {
      return;
    }

    this.accepting.set(true);

    this.error.set('');

    try {
      await this.invites.acceptInvite(invite.id);

      /*
       * O batch do convite alterou
       * activeBabyId no perfil.
       *
       * Recarregamos primeiro o contexto
       * do bebê para concluir a migração
       * específica do responsável.
       */
      await this.babyContext.reload();

      /*
       * BabyMigrationService sincroniza
       * nome e data do bebê no perfil.
       * Relemos o onboarding depois disso.
       */
      await this.onboarding.reload();

      await this.router.navigate(['/home']);
    } catch (error) {
      this.error.set(this.inviteErrorMessage(error));
    } finally {
      this.accepting.set(false);
    }
  }

  private async loadInvite(): Promise<void> {
    const invite = await this.invites.readInvite(this.token);

    if (invite === null) {
      this.error.set('Este convite não existe ou não está mais disponível.');

      return;
    }

    if (invite.status !== 'pending') {
      this.error.set('Este convite já foi utilizado.');

      return;
    }

    if (invite.expiresAt <= Date.now()) {
      this.error.set('Este convite expirou.');

      return;
    }

    if (invite.createdByUid === this.auth.user()?.uid) {
      this.error.set('O proprietário não pode aceitar o próprio convite.');

      return;
    }

    this.invite.set(invite);
  }

  private inviteErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Convite não encontrado.':
        case 'Este convite já foi utilizado.':
        case 'Este convite expirou.':
        case 'O proprietário não pode aceitar o próprio convite.':
          return error.message;
      }
    }

    return 'Não foi possível aceitar o convite. ' + 'Verifique sua conexão e tente novamente.';
  }
}
