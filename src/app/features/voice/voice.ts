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
  private awaitingDiaperType = false;

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
    this.awaitingDiaperType = false;
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

    this.commandExecuted.set(false);

    if (/^(cancelar|cancele)$/.test(command)) {
      this.cancelListening();
      return;
    }

    if (/\b(nao|nunca|nem)\b/.test(command)) {
      this.awaitingDiaperType = false;

      this.voiceService.reportError(
        'Identifiquei uma frase negativa. Nenhuma ação foi executada.',
      );

      this.feedback.set(
        'Para registrar, diga um comando direto e completo.',
      );
      return;
    }

    const navigationCommands = [
      {
        pattern: /^(abrir inicio|ir para inicio|ir para o inicio|voltar ao inicio|inicio)$/,
        destination: '/home',
        message: 'Abrindo a página inicial.',
      },
      {
        pattern: /^(abrir rotina|ir para rotina|ir para a rotina|rotina)$/,
        destination: '/routine',
        message: 'Abrindo a rotina.',
      },
      {
        pattern: /^(abrir historico|ir para historico|ir para o historico|historico)$/,
        destination: '/history',
        message: 'Abrindo o histórico.',
      },
      {
        pattern: /^(abrir mamada|acompanhar mamada|mamada)$/,
        destination: '/feeding',
        message: 'Abrindo o registro de mamada.',
      },
      {
        pattern: /^(abrir sono|acompanhar sono)$/,
        destination: '/sleep',
        message: 'Abrindo o registro de sono.',
      },
      {
        pattern: /^(abrir fralda|ir para fralda|ir para a fralda)$/,
        destination: '/diaper',
        message: 'Abrindo o registro de fralda.',
      },
    ];

    const navigation = navigationCommands.find(
      (option) => option.pattern.test(command),
    );

    if (navigation) {
      this.awaitingDiaperType = false;
      this.navigateTo(
        navigation.destination,
        navigation.message,
      );
      return;
    }

    const diaperTypes: Record<string, DiaperType> = {
      molhada: 'wet',
      xixi: 'wet',
      suja: 'dirty',
      coco: 'dirty',
      ambas: 'both',
      'molhada e suja': 'both',
      'suja e molhada': 'both',
      'xixi e coco': 'both',
      'coco e xixi': 'both',
    };

    // Uma resposta curta só registra quando o tipo foi solicitado.
    if (
      this.awaitingDiaperType &&
      Object.prototype.hasOwnProperty.call(diaperTypes, command)
    ) {
      this.awaitingDiaperType = false;
      this.registerDiaper(diaperTypes[command]);
      return;
    }

    // Qualquer outra frase encerra a solicitação anterior.
    this.awaitingDiaperType = false;

    if (/^(registrar fralda|trocar fralda|fralda)$/.test(command)) {
      this.awaitingDiaperType = true;

      this.voiceService.reportError(
        'Qual foi o tipo da fralda: molhada, suja ou ambas?',
      );

      this.feedback.set(
        'Toque novamente no microfone e informe o tipo. Nenhuma fralda foi registrada ainda.',
      );
      return;
    }

    const diaperMatch = command.match(
      /^(?:(?:registrar|trocar) )?fralda (molhada|suja|ambas|xixi|coco|molhada e suja|suja e molhada|xixi e coco|coco e xixi)$/,
    );

    if (diaperMatch) {
      this.registerDiaper(diaperTypes[diaperMatch[1]]);
      return;
    }

    if (/^(finalizar|encerrar|terminar|parar) mamada$/.test(command)) {
      this.finishFeeding();
      return;
    }

    if (
      /^(registrar|iniciar|comecar) mamada(?: (?:no lado (?:esquerdo|direito)|lado (?:esquerdo|direito)|na mama (?:esquerda|direita)|no seio (?:esquerdo|direito)))?$/.test(
        command,
      )
    ) {
      this.startFeeding(command);
      return;
    }

    if (
      /^(lado esquerdo|mudar para esquerda|trocar para esquerda|mudar para o lado esquerdo|trocar para o lado esquerdo)$/.test(
        command,
      )
    ) {
      this.changeFeedingSide('left');
      return;
    }

    if (
      /^(lado direito|mudar para direita|trocar para direita|mudar para o lado direito|trocar para o lado direito)$/.test(
        command,
      )
    ) {
      this.changeFeedingSide('right');
      return;
    }

    if (
      /^(finalizar sono|encerrar sono|terminar sono|acordou)$/.test(
        command,
      )
    ) {
      this.finishSleep();
      return;
    }

    if (
      /^(registrar sono|iniciar sono|comecar sono|dormiu)$/.test(
        command,
      )
    ) {
      this.startSleep();
      return;
    }

    this.voiceService.reportError(
      'Não reconheci um comando único e completo. Tente dizer “registrar mamada”, “iniciar sono” ou “registrar fralda suja”.',
    );

    this.feedback.set(
      'Nenhuma ação foi executada. Diga apenas um comando por vez.',
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
      this.feedingService.storageError(),
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

    this.completeCommand(
      'Mamada finalizada com sucesso.',
      this.feedingService.storageError(),
    );
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
      this.feedingService.storageError(),
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
      this.sleepService.storageError(),
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

    this.completeCommand(
      'Sono finalizado com sucesso.',
      this.sleepService.storageError(),
    );
  }

  private registerDiaper(type: DiaperType): void {
    this.diaperService.register(type);

    this.completeCommand(
      `Fralda ${this.diaperService
        .label(type)
        .toLocaleLowerCase('pt-BR')} registrada agora.`,
      this.diaperService.storageError(),
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

  private completeCommand(
    message: string,
    storageError: string | null = null,
  ): void {
    if (storageError !== null) {
      this.commandExecuted.set(false);

      this.feedback.set(
        'O registro foi atualizado nesta sessão, mas não foi possível confirmar o salvamento no dispositivo.',
      );

      this.voiceService.reportError(
        `${storageError} Os dados desta sessão podem ser perdidos ao recarregar ou fechar a página. Confira o histórico antes de repetir o comando.`,
      );

      return;
    }

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