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


import {
  DiaperService,
} from '../../core/services/diaper';
import { AuthService } from '../../core/services/auth';
import { BabyContextService } from '../../core/services/baby-context';

import {
  FeedingService,
} from '../../core/services/feeding';

import {
  SleepService,
} from '../../core/services/sleep';

import {
  VoiceService,
} from '../../core/services/voice';

type PendingVoiceCommand = {
  readonly babyId: string;
  readonly uid: string;
  readonly recordedAt: number;
  readonly issuedAt: number;
  readonly summary: string;
} & (
  | { readonly kind: 'sleep' }
  | { readonly kind: 'wake'; readonly sleepId: string }
  | { readonly kind: 'bottle'; readonly volumeMl: number }
);

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

  private readonly auth = inject(AuthService);
  private readonly babyContext = inject(BabyContextService);

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

  readonly pendingCommand = signal<PendingVoiceCommand | null>(null);
  readonly confirming = signal(false);

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
    this.pendingCommand.set(null);
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
    this.pendingCommand.set(null);
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
    this.pendingCommand.set(null);
    this.voiceService.stop();

    void this.router.navigate([
      '/home',
    ]);
  }

  useManualRegistration():
    void {
    this.pendingCommand.set(null);
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

    this.pendingCommand.set(null);

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

    if (this.prepareNaturalCommand(command)) {
      this.awaitingDiaperType = false;
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
          /^(?:abrir |acompanhar )?(?:amamentacao|mamada)$/,

        destination:
          '/feeding',

        message:
          'Abrindo o registro de amamentação.',
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
      /^(finalizar|encerrar|terminar|parar) (?:amamentacao|mamada)$/.test(
        command,
      )
    ) {
      await this.finishFeeding();
      return;
    }

    if (/^(registrar|iniciar|comecar) (?:amamentacao|mamada)$/.test(command)) {
      await this.startFeeding();
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
        'Não reconheci um comando único e completo. Tente dizer “registrar amamentação”, “iniciar sono” ou “registrar fralda suja”.',
      );

    this.feedback.set(
      'Nenhuma ação foi executada. Diga apenas um comando por vez.',
    );
  }

  private prepareNaturalCommand(command: string): boolean {
    const sleepMatch = command.match(/^(?:(.+?) )?dormiu (?:ha|a) (.+?) (minuto|minutos|hora|horas)$/);
    const wakeMatch = command.match(/^(?:(?:o|a) )?(.+?) acordou$/);
    const bottleMatch = command.match(/^(?:registrar )?mamadeira(?: de)? (.+?) (ml|mililitro|mililitros)$/);

    if (!sleepMatch && !wakeMatch && !bottleMatch) {
      if (/\b(dormiu (?:ha|a)|mamadeira)\b/.test(command)) {
        this.voiceService.reportError('Informe um tempo ou volume claro. Exemplos: “Lucas dormiu há 15 minutos” ou “registrar mamadeira de 120 ml”.');
        this.feedback.set('Nenhum registro foi salvo.');
        return true;
      }

      return false;
    }

    const baby = this.babyContext.baby();
    const uid = this.auth.user()?.uid;

    if (!baby || !uid) {
      this.voiceService.reportError('Selecione um bebê e entre na sua conta antes de registrar.');
      return true;
    }

    const issuedAt = Date.now();

    if (sleepMatch) {
      const spokenName = sleepMatch[1]?.replace(/^(o|a) /, '');
      const amount = this.parseAmount(sleepMatch[2]);
      const minutes = amount === null ? null : amount * (sleepMatch[3].startsWith('hora') ? 60 : 1);

      if (spokenName && spokenName !== this.normalize(baby.name)) {
        this.voiceService.reportError(`O nome informado não corresponde ao bebê ativo (${baby.name}). Nenhum sono foi registrado.`);
        return true;
      }

      if (minutes === null || minutes < 1 || minutes > 1440) {
        this.voiceService.reportError('Informe um tempo entre 1 minuto e 24 horas. Nenhum sono foi registrado.');
        return true;
      }

      const startedAt = issuedAt - minutes * 60_000;
      const when = new Date(startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      this.pendingCommand.set({
        kind: 'sleep', babyId: baby.id, uid, recordedAt: startedAt, issuedAt,
        summary: `Iniciar sono de ${baby.name} em ${when} (há ${minutes} min).`,
      });
    } else if (wakeMatch) {
      if (wakeMatch[1] !== this.normalize(baby.name)) {
        this.voiceService.reportError(`O nome informado não corresponde ao bebê ativo (${baby.name}). Nenhum sono foi finalizado.`);
        return true;
      }

      const activeSleep = this.sleepService.activeSleep();

      if (!activeSleep) {
        this.voiceService.reportError('Não existe um sono em andamento para finalizar.');
        return true;
      }

      this.pendingCommand.set({
        kind: 'wake', babyId: baby.id, uid, recordedAt: issuedAt, issuedAt, sleepId: activeSleep.id,
        summary: `Finalizar o sono de ${baby.name} ao confirmar.`,
      });
    } else if (bottleMatch) {
      const volumeMl = this.parseAmount(bottleMatch[1]);

      if (volumeMl === null || volumeMl < 1 || volumeMl > 1000) {
        this.voiceService.reportError('Informe um volume inteiro entre 1 e 1000 ml. Nenhuma mamadeira foi registrada.');
        return true;
      }

      const when = new Date(issuedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      this.pendingCommand.set({
        kind: 'bottle', babyId: baby.id, uid, recordedAt: issuedAt, issuedAt, volumeMl,
        summary: `Registrar mamadeira de ${volumeMl} ml para ${baby.name} em ${when}.`,
      });
    }

    this.feedback.set('Confira os dados e confirme antes de salvar.');
    return true;
  }

  async confirmPending(): Promise<void> {
    const pending = this.pendingCommand();

    if (!pending || this.confirming()) {
      return;
    }

    if (Date.now() - pending.issuedAt > 120_000 ||
      this.auth.user()?.uid !== pending.uid ||
      this.babyContext.activeBabyId() !== pending.babyId) {
      this.pendingCommand.set(null);
      this.voiceService.reportError('A confirmação expirou ou o bebê/conta mudou. Diga o comando novamente.');
      return;
    }

    this.confirming.set(true);

    try {
      if (pending.kind === 'sleep') {
        if (this.sleepService.activeSleep()) {
          this.pendingCommand.set(null);
          this.voiceService.reportError('Já existe um sono em andamento. Nenhum novo sono foi criado.');
          return;
        }

        const sleep = await this.sleepService.startAt(pending.recordedAt);

        if (!sleep) {
          this.pendingCommand.set(null);
          this.reportSyncFailure(this.sleepService.storageError(), 'Não foi possível iniciar o sono.');
          return;
        }

        this.pendingCommand.set(null);
        this.completeCommand('Sono registrado no horário confirmado.');
      } else if (pending.kind === 'wake') {
        if (this.sleepService.activeSleep()?.id !== pending.sleepId) {
          this.pendingCommand.set(null);
          this.voiceService.reportError('O sono em andamento mudou. Diga o comando novamente.');
          return;
        }

        const finished = await this.sleepService.finish();

        if (!finished) {
          this.pendingCommand.set(null);
          this.reportSyncFailure(this.sleepService.storageError(), 'Não foi possível finalizar o sono.');
          return;
        }

        this.pendingCommand.set(null);
        this.completeCommand('Sono finalizado com sucesso.');
      } else {
        const bottle = await this.feedingService.registerBottle(pending.volumeMl, pending.recordedAt);

        if (!bottle) {
          this.pendingCommand.set(null);
          this.reportSyncFailure(this.feedingService.storageError(), 'Não foi possível registrar a mamadeira. Confira se já existe um registro igual neste horário.');
          return;
        }

        this.pendingCommand.set(null);
        this.completeCommand(`Mamadeira de ${pending.volumeMl} ml registrada.`);
      }
    } finally {
      this.confirming.set(false);
    }
  }

  cancelPending(): void {
    this.pendingCommand.set(null);
    this.voiceService.stop();
    this.feedback.set('Registro cancelado. Nada foi salvo.');
  }

  private parseAmount(value: string): number | null {
    if (/^\d{1,4}$/.test(value)) {
      return Number(value);
    }

    const words: Record<string, number> = {
      um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
      seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
      treze: 13, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
      dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
      cinquenta: 50, sessenta: 60, cem: 100, cento: 100,
    };

    if (Object.prototype.hasOwnProperty.call(words, value)) {
      return words[value];
    }

    const compound = value.match(/^(vinte|trinta|quarenta|cinquenta|sessenta|cento) e (.+)$/);
    const suffix = compound ? words[compound[2]] : null;

    return compound && suffix !== undefined && suffix !== null &&
      (compound[1] === 'cento' ? suffix <= 90 : suffix < 10)
      ? words[compound[1]] + suffix : null;
  }

  private async startFeeding(): Promise<void> {
    const alreadyActive = this.feedingService.activeFeeding() !== null;
    const feeding = await this.feedingService.start();

    if (feeding === null) {
      this.reportSyncFailure(
        this.feedingService.storageError(),
        'Não foi possível iniciar a amamentação.',
      );
      return;
    }

    this.completeCommand(
      alreadyActive
        ? 'A amamentação já estava em andamento.'
        : 'Amamentação iniciada agora.',
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
          'Não existe uma amamentação em andamento para finalizar.',
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

        'Não foi possível finalizar a amamentação.',
      );

      return;
    }

    this.completeCommand(
      'Amamentação finalizada com sucesso.',
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
