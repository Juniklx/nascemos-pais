import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import type {
  DiaperType,
} from '../../core/models/diaper';

import type {
  FeedingSide,
} from '../../core/models/feeding';

import {
  DiaperService,
} from '../../core/services/diaper';

import {
  FeedingService,
} from '../../core/services/feeding';

import {
  SleepService,
} from '../../core/services/sleep';

import {
  VoiceService,
} from '../../core/services/voice';

@Component({
  selector: 'app-voice',
  imports: [],
  templateUrl: './voice.html',
  styleUrl: './voice.css',
})
export class VoicePage {
  private readonly router =
    inject(Router);

  private readonly destroyRef =
    inject(DestroyRef);

  private readonly voiceService =
    inject(VoiceService);

  private readonly feedingService =
    inject(FeedingService);

  private readonly sleepService =
    inject(SleepService);

  private readonly diaperService =
    inject(DiaperService);

  private lastProcessedTranscript:
    string | null = null;

  private awaitingDiaperType =
    false;

  readonly status =
    this.voiceService.status;

  readonly transcript =
    this.voiceService.transcript;

  readonly error =
    this.voiceService.error;

  readonly supported =
    this.voiceService.supported;

  readonly feedback =
    signal(
      'Toque no microfone e diga o que deseja registrar.',
    );

  readonly commandExecuted =
    signal(false);

  constructor() {
    effect(() => {
      const transcript =
        this.transcript();

      if (
        transcript === null ||
        transcript ===
          this.lastProcessedTranscript
      ) {
        return;
      }

      this.lastProcessedTranscript =
        transcript;

      void this.executeCommand(
        transcript,
      );
    });

    this.destroyRef.onDestroy(
      () => {
        this.voiceService.stop();
      },
    );
  }

  startListening(): void {
    this.lastProcessedTranscript =
      null;

    this.commandExecuted.set(
      false,
    );

    this.feedback.set(
      'Estou ouvindo…',
    );

    this.voiceService.start();
  }

  cancelListening(): void {
    this.awaitingDiaperType =
      false;

    this.voiceService.stop();

    this.lastProcessedTranscript =
      null;

    this.commandExecuted.set(
      false,
    );

    this.feedback.set(
      'Captura cancelada. Nenhum comando foi executado.',
    );
  }

  goHome(): void {
    this.voiceService.stop();

    void this.router.navigate([
      '/home',
    ]);
  }

  useManualRegistration():
    void {
    this.voiceService.stop();

    void this.router.navigate([
      '/home',
    ]);
  }

  private async executeCommand(
    transcript: string,
  ): Promise<void> {
    const command =
      this.normalize(
        transcript,
      );

    this.commandExecuted.set(
      false,
    );

    if (
      /^(cancelar|cancele)$/.test(
        command,
      )
    ) {
      this.cancelListening();
      return;
    }

    if (
      /\b(nao|nunca|nem)\b/.test(
        command,
      )
    ) {
      this.awaitingDiaperType =
        false;

      this.voiceService
        .reportError(
          'Identifiquei uma frase negativa. Nenhuma ação foi executada.',
        );

      this.feedback.set(
        'Para registrar, diga um comando direto e completo.',
      );

      return;
    }

    const navigationCommands = [
      {
        pattern:
          /^(abrir inicio|ir para inicio|ir para o inicio|voltar ao inicio|inicio)$/,

        destination:
          '/home',

        message:
          'Abrindo a página inicial.',
      },
      {
        pattern:
          /^(abrir rotina|ir para rotina|ir para a rotina|rotina)$/,

        destination:
          '/routine',

        message:
          'Abrindo a rotina.',
      },
      {
        pattern:
          /^(abrir historico|ir para historico|ir para o historico|historico)$/,

        destination:
          '/history',

        message:
          'Abrindo o histórico.',
      },
      {
        pattern:
          /^(abrir mamada|acompanhar mamada|mamada)$/,

        destination:
          '/feeding',

        message:
          'Abrindo o registro de mamada.',
      },
      {
        pattern:
          /^(abrir sono|acompanhar sono)$/,

        destination:
          '/sleep',

        message:
          'Abrindo o registro de sono.',
      },
      {
        pattern:
          /^(abrir fralda|ir para fralda|ir para a fralda)$/,

        destination:
          '/diaper',

        message:
          'Abrindo o registro de fralda.',
      },
    ];

    const navigation =
      navigationCommands
        .find(
          (option) =>
            option.pattern
              .test(
                command,
              ),
        );

    if (navigation) {
      this.awaitingDiaperType =
        false;

      this.navigateTo(
        navigation.destination,
        navigation.message,
      );

      return;
    }

    const diaperTypes:
      Record<
        string,
        DiaperType
      > = {
        molhada: 'wet',
        xixi: 'wet',
        suja: 'dirty',
        coco: 'dirty',
        ambas: 'both',

        'molhada e suja':
          'both',

        'suja e molhada':
          'both',

        'xixi e coco':
          'both',

        'coco e xixi':
          'both',
      };

    if (
      this.awaitingDiaperType &&
      Object.prototype
        .hasOwnProperty
        .call(
          diaperTypes,
          command,
        )
    ) {
      this.awaitingDiaperType =
        false;

      await this.registerDiaper(
        diaperTypes[
          command
        ],
      );

      return;
    }

    this.awaitingDiaperType =
      false;

    if (
      /^(registrar fralda|trocar fralda|fralda)$/.test(
        command,
      )
    ) {
      this.awaitingDiaperType =
        true;

      this.voiceService
        .reportError(
          'Qual foi o tipo da fralda: molhada, suja ou ambas?',
        );

      this.feedback.set(
        'Toque novamente no microfone e informe o tipo. Nenhuma fralda foi registrada ainda.',
      );

      return;
    }

    const diaperMatch =
      command.match(
        /^(?:(?:registrar|trocar) )?fralda (molhada|suja|ambas|xixi|coco|molhada e suja|suja e molhada|xixi e coco|coco e xixi)$/,
      );

    if (diaperMatch) {
      await this.registerDiaper(
        diaperTypes[
          diaperMatch[1]
        ],
      );

      return;
    }

    if (
      /^(finalizar|encerrar|terminar|parar) mamada$/.test(
        command,
      )
    ) {
      await this.finishFeeding();
      return;
    }

    if (
      /^(registrar|iniciar|comecar) mamada(?: (?:no lado (?:esquerdo|direito)|lado (?:esquerdo|direito)|na mama (?:esquerda|direita)|no seio (?:esquerdo|direito)))?$/.test(
        command,
      )
    ) {
      await this.startFeeding(
        command,
      );

      return;
    }

    if (
      /^(lado esquerdo|mudar para esquerda|trocar para esquerda|mudar para o lado esquerdo|trocar para o lado esquerdo)$/.test(
        command,
      )
    ) {
      await this.changeFeedingSide(
        'left',
      );

      return;
    }

    if (
      /^(lado direito|mudar para direita|trocar para direita|mudar para o lado direito|trocar para o lado direito)$/.test(
        command,
      )
    ) {
      await this.changeFeedingSide(
        'right',
      );

      return;
    }

    if (
      /^(finalizar sono|encerrar sono|terminar sono|acordou)$/.test(
        command,
      )
    ) {
      await this.finishSleep();
      return;
    }

    if (
      /^(registrar sono|iniciar sono|comecar sono|dormiu)$/.test(
        command,
      )
    ) {
      await this.startSleep();
      return;
    }

    this.voiceService
      .reportError(
        'Não reconheci um comando único e completo. Tente dizer “registrar mamada”, “iniciar sono” ou “registrar fralda suja”.',
      );

    this.feedback.set(
      'Nenhuma ação foi executada. Diga apenas um comando por vez.',
    );
  }

  private async startFeeding(
    command: string,
  ): Promise<void> {
    const alreadyActive =
      this.feedingService
        .activeFeeding() !==
      null;

    const feeding =
      await this.feedingService
        .start();

    if (feeding === null) {
      this.reportSyncFailure(
        this.feedingService
          .storageError(),

        'Não foi possível iniciar a mamada.',
      );

      return;
    }

    const side =
      this.feedingSideFromCommand(
        command,
      );

    if (side !== null) {
      const changed =
        await this.feedingService
          .setSide(side);

      if (!changed) {
        this.reportSyncFailure(
          this.feedingService
            .storageError(),

          'Não foi possível registrar o lado da mamada.',
        );

        return;
      }
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

  private async finishFeeding():
    Promise<void> {
    if (
      this.feedingService
        .activeFeeding() ===
      null
    ) {
      this.voiceService
        .reportError(
          'Não existe uma mamada em andamento para finalizar.',
        );

      this.feedback.set(
        'Nenhuma atividade foi alterada.',
      );

      return;
    }

    const finished =
      await this.feedingService
        .finish();

    if (finished === null) {
      this.reportSyncFailure(
        this.feedingService
          .storageError(),

        'Não foi possível finalizar a mamada.',
      );

      return;
    }

    this.completeCommand(
      'Mamada finalizada com sucesso.',
    );
  }

  private async changeFeedingSide(
    side: FeedingSide,
  ): Promise<void> {
    if (
      this.feedingService
        .activeFeeding() ===
      null
    ) {
      this.voiceService
        .reportError(
          'Não existe uma mamada em andamento. Inicie a mamada antes de informar o lado.',
        );

      this.feedback.set(
        'Nenhuma atividade foi alterada.',
      );

      return;
    }

    const changed =
      await this.feedingService
        .setSide(side);

    if (!changed) {
      this.reportSyncFailure(
        this.feedingService
          .storageError(),

        'Não foi possível alterar o lado da mamada.',
      );

      return;
    }

    this.completeCommand(
      side === 'left'
        ? 'Mamada alterada para o lado esquerdo.'
        : 'Mamada alterada para o lado direito.',
    );
  }

  private async startSleep():
    Promise<void> {
    const alreadyActive =
      this.sleepService
        .activeSleep() !==
      null;

    const sleep =
      await this.sleepService
        .start();

    if (sleep === null) {
      this.reportSyncFailure(
        this.sleepService
          .storageError(),

        'Não foi possível iniciar o sono.',
      );

      return;
    }

    this.completeCommand(
      alreadyActive
        ? 'O sono já estava em andamento.'
        : 'Sono iniciado agora.',
    );
  }

  private async finishSleep():
    Promise<void> {
    if (
      this.sleepService
        .activeSleep() ===
      null
    ) {
      this.voiceService
        .reportError(
          'Não existe um sono em andamento para finalizar.',
        );

      this.feedback.set(
        'Nenhuma atividade foi alterada.',
      );

      return;
    }

    const finished =
      await this.sleepService
        .finish();

    if (finished === null) {
      this.reportSyncFailure(
        this.sleepService
          .storageError(),

        'Não foi possível finalizar o sono.',
      );

      return;
    }

    this.completeCommand(
      'Sono finalizado com sucesso.',
    );
  }

  private async registerDiaper(
    type: DiaperType,
  ): Promise<void> {
    const diaper =
      await this.diaperService
        .register(type);

    if (diaper === null) {
      this.reportSyncFailure(
        this.diaperService
          .storageError(),

        'Não foi possível registrar a fralda.',
      );

      return;
    }

    this.completeCommand(
      `Fralda ${this.diaperService
        .label(type)
        .toLocaleLowerCase(
          'pt-BR',
        )} registrada agora.`,
    );
  }

  private feedingSideFromCommand(
    command: string,
  ): FeedingSide | null {
    if (
      this.hasAny(
        command,
        [
          'lado esquerdo',
          'mama esquerda',
          'seio esquerdo',
        ],
      )
    ) {
      return 'left';
    }

    if (
      this.hasAny(
        command,
        [
          'lado direito',
          'mama direita',
          'seio direito',
        ],
      )
    ) {
      return 'right';
    }

    return null;
  }

  private reportSyncFailure(
    error:
      string | null,
    fallback: string,
  ): void {
    this.commandExecuted.set(
      false,
    );

    this.feedback.set(
      'A alteração não foi confirmada na nuvem.',
    );

    this.voiceService
      .reportError(
        error ??
          `${fallback} Verifique sua conexão e tente novamente.`,
      );
  }

  private completeCommand(
    message: string,
  ): void {
    this.commandExecuted.set(
      true,
    );

    this.feedback.set(
      message,
    );
  }

  private navigateTo(
    destination: string,
    message: string,
  ): void {
    this.completeCommand(
      message,
    );

    this.voiceService.stop();

    void this.router.navigate([
      destination,
    ]);
  }

  private normalize(
    value: string,
  ): string {
    return value
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLocaleLowerCase(
        'pt-BR',
      )
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ' ',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }

  private hasAny(
    command: string,
    possibilities:
      readonly string[],
  ): boolean {
    return possibilities.some(
      (possibility) =>
        command.includes(
          possibility,
        ),
    );
  }
}