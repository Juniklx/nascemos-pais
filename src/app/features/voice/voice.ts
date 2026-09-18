import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import type { DiaperType } from '../../core/models/diaper';
import type { FeedingSide } from '../../core/models/feeding';
import { DiaperService } from '../../core/services/diaper';
import { FeedingService } from '../../core/services/feeding';
import { SleepService } from '../../core/services/sleep';
import { VoiceService } from '../../core/services/voice';

@Component({
  selector: 'app-voice',
  imports: [],
  templateUrl: './voice.html',
  styleUrl: './voice.css',
})
export class VoicePage {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly voiceService = inject(VoiceService);
  private readonly feedingService =
    inject(FeedingService);
  private readonly sleepService = inject(SleepService);
  private readonly diaperService = inject(DiaperService);

  private lastProcessedTranscript: string | null = null;

  readonly status = this.voiceService.status;
  readonly transcript = this.voiceService.transcript;
  readonly error = this.voiceService.error;
  readonly supported = this.voiceService.supported;

  readonly feedback = signal(
    'Toque no microfone e diga o que deseja registrar.',
  );

  readonly commandExecuted = signal(false);

  constructor() {
    effect(() => {
      const transcript = this.transcript();

      if (
        transcript === null ||
        transcript === this.lastProcessedTranscript
      ) {
        return;
      }

      this.lastProcessedTranscript = transcript;
      this.executeCommand(transcript);
    });

    this.destroyRef.onDestroy(() => {
      this.voiceService.stop();
    });
  }

  startListening(): void {
    this.lastProcessedTranscript = null;
    this.commandExecuted.set(false);
    this.feedback.set('Estou ouvindo…');
    this.voiceService.start();
  }

  cancelListening(): void {
    this.voiceService.stop();
    this.lastProcessedTranscript = null;
    this.commandExecuted.set(false);
    this.feedback.set(
      'Captura cancelada. Nenhum comando foi executado.',
    );
  }

  goHome(): void {
    this.voiceService.stop();
    void this.router.navigate(['/home']);
  }

  useManualRegistration(): void {
    this.voiceService.stop();
    void this.router.navigate(['/home']);
  }

  private executeCommand(transcript: string): void {
    const command = this.normalize(transcript);

    if (this.hasAny(command, ['cancelar', 'cancele'])) {
      this.cancelListening();
      return;
    }

    if (
      this.hasAny(command, [
        'finalizar mamada',
        'encerrar mamada',
        'terminar mamada',
        'parar mamada',
      ])
    ) {
      this.finishFeeding();
      return;
    }

    if (
      this.hasAny(command, [
        'registrar mamada',
        'iniciar mamada',
        'comecar mamada',
      ])
    ) {
      this.startFeeding(command);
      return;
    }

    if (
      this.hasAny(command, [
        'lado esquerdo',
        'mudar para esquerda',
        'trocar para esquerda',
      ])
    ) {
      this.changeFeedingSide('left');
      return;
    }

    if (
      this.hasAny(command, [
        'lado direito',
        'mudar para direita',
        'trocar para direita',
      ])
    ) {
      this.changeFeedingSide('right');
      return;
    }

    if (
      this.hasAny(command, [
        'finalizar sono',
        'encerrar sono',
        'terminar sono',
        'acordou',
      ])
    ) {
      this.finishSleep();
      return;
    }

    if (
      this.hasAny(command, [
        'registrar sono',
        'iniciar sono',
        'comecar sono',
        'dormiu',
      ])
    ) {
      this.startSleep();
      return;
    }

    if (
      command.includes('fralda') &&
      this.hasAny(command, ['ambas', 'molhada e suja'])
    ) {
      this.registerDiaper('both');
      return;
    }

    if (
      command.includes('fralda') &&
      this.hasAny(command, ['suja', 'coco'])
    ) {
      this.registerDiaper('dirty');
      return;
    }

    if (
      command.includes('fralda') &&
      this.hasAny(command, ['molhada', 'xixi'])
    ) {
      this.registerDiaper('wet');
      return;
    }

    if (
      this.hasAny(command, [
        'registrar fralda',
        'trocar fralda',
        'fralda',
      ])
    ) {
      this.voiceService.reportError(
        'Qual foi o tipo da fralda: molhada, suja ou ambas?',
      );
      this.feedback.set(
        'O comando precisa informar o tipo da fralda.',
      );
      return;
    }

    if (
      this.hasAny(command, [
        'abrir inicio',
        'ir para inicio',
        'voltar ao inicio',
        'inicio'
      ])
    ) {
      this.navigateTo(
        '/home',
        'Abrindo a página inicial.',
      );
      return;
    }

    if (
      this.hasAny(command, [
        'abrir rotina',
        'ir para rotina',
        'rotina'
      ])
    ) {
      this.navigateTo(
        '/routine',
        'Abrindo a rotina.',
      );
      return;
    }

    if (
      this.hasAny(command, [
        'abrir historico',
        'ir para historico',
        'historico'
      ])
    ) {
      this.navigateTo(
        '/history',
        'Abrindo o histórico.',
      );
      return;
    }

    if (
      this.hasAny(command, [
        'abrir mamada',
        'acompanhar mamada',
        'mamada'
      ])
    ) {
      this.navigateTo(
        '/feeding',
        'Abrindo o registro de mamada.',
      );
      return;
    }

    if (
      this.hasAny(command, [
        'abrir sono',
        'acompanhar sono',
      ])
    ) {
      this.navigateTo(
        '/sleep',
        'Abrindo o registro de sono.',
      );
      return;
    }

    if (
      this.hasAny(command, [
        'abrir fralda',
        'ir para fralda',
      ])
    ) {
      this.navigateTo(
        '/diaper',
        'Abrindo o registro de fralda.',
      );
      return;
    }

    this.voiceService.reportError(
      'Não reconheci esse comando. Tente dizer “registrar mamada”, “iniciar sono” ou “registrar fralda suja”.',
    );

    this.feedback.set(
      'Nenhuma atividade foi registrada.',
    );
  }

  private startFeeding(command: string): void {
    const alreadyActive =
      this.feedingService.activeFeeding() !== null;

    this.feedingService.start();

    const side = this.feedingSideFromCommand(command);

    if (side !== null) {
      this.feedingService.setSide(side);
    }

    const sideDescription =
      side === 'left'
        ? ' no lado esquerdo'
        : side === 'right'
          ? ' no lado direito'
          : '';

    this.completeCommand(
      alreadyActive
        ? `A mamada já estava em andamento${sideDescription}.`
        : `Mamada iniciada agora${sideDescription}.`,
    );
  }

  private finishFeeding(): void {
    const finished = this.feedingService.finish();

    if (finished === null) {
      this.voiceService.reportError(
        'Não existe uma mamada em andamento para finalizar.',
      );
      this.feedback.set(
        'Nenhuma atividade foi alterada.',
      );
      return;
    }

    this.completeCommand('Mamada finalizada com sucesso.');
  }

  private changeFeedingSide(side: FeedingSide): void {
    if (this.feedingService.activeFeeding() === null) {
      this.voiceService.reportError(
        'Não existe uma mamada em andamento. Inicie a mamada antes de informar o lado.',
      );
      this.feedback.set(
        'Nenhuma atividade foi alterada.',
      );
      return;
    }

    this.feedingService.setSide(side);

    this.completeCommand(
      side === 'left'
        ? 'Mamada alterada para o lado esquerdo.'
        : 'Mamada alterada para o lado direito.',
    );
  }

  private startSleep(): void {
    const alreadyActive =
      this.sleepService.activeSleep() !== null;

    this.sleepService.start();

    this.completeCommand(
      alreadyActive
        ? 'O sono já estava em andamento.'
        : 'Sono iniciado agora.',
    );
  }

  private finishSleep(): void {
    const finished = this.sleepService.finish();

    if (finished === null) {
      this.voiceService.reportError(
        'Não existe um sono em andamento para finalizar.',
      );
      this.feedback.set(
        'Nenhuma atividade foi alterada.',
      );
      return;
    }

    this.completeCommand('Sono finalizado com sucesso.');
  }

  private registerDiaper(type: DiaperType): void {
    this.diaperService.register(type);

    this.completeCommand(
      `Fralda ${this.diaperService
        .label(type)
        .toLocaleLowerCase('pt-BR')} registrada agora.`,
    );
  }

  private feedingSideFromCommand(
    command: string,
  ): FeedingSide | null {
    if (
      this.hasAny(command, [
        'lado esquerdo',
        'mama esquerda',
        'seio esquerdo',
      ])
    ) {
      return 'left';
    }

    if (
      this.hasAny(command, [
        'lado direito',
        'mama direita',
        'seio direito',
      ])
    ) {
      return 'right';
    }

    return null;
  }

  private completeCommand(message: string): void {
    this.commandExecuted.set(true);
    this.feedback.set(message);
  }

  private navigateTo(
    destination: string,
    message: string,
  ): void {
    this.completeCommand(message);
    this.voiceService.stop();
    void this.router.navigate([destination]);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAny(
    command: string,
    possibilities: readonly string[],
  ): boolean {
    return possibilities.some((possibility) =>
      command.includes(possibility),
    );
  }
}