import {
  Injectable,
  signal,
} from '@angular/core';

export type VoiceStatus =
  | 'ready'
  | 'listening'
  | 'recognized'
  | 'error'
  | 'unsupported'
  | 'permission-denied';

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;

  onerror:
    | ((event: SpeechRecognitionErrorEventLike) => void)
    | null;

  onend: (() => void) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceService {
  private readonly statusState =
    signal<VoiceStatus>('ready');

  private readonly transcriptState =
    signal<string | null>(null);

  private readonly errorState =
    signal<string | null>(null);

  private recognition: SpeechRecognitionLike | null = null;
  private cancelled = false;

  readonly status = this.statusState.asReadonly();
  readonly transcript = this.transcriptState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly supported = this.getConstructor() !== null;

  start(): void {
    const Recognition = this.getConstructor();

    if (Recognition === null) {
      this.statusState.set('unsupported');
      this.errorState.set(
        'O reconhecimento de voz não está disponível neste navegador. Use os botões de registro.',
      );
      return;
    }

    if (this.statusState() === 'listening') {
      return;
    }

    this.cancelled = false;
    this.transcriptState.set(null);
    this.errorState.set(null);

    if (this.recognition === null) {
      this.recognition = new Recognition();
      this.configureRecognition(this.recognition);
    }

    this.statusState.set('listening');

    try {
      this.recognition.start();
    } catch {
      this.statusState.set('error');
      this.errorState.set(
        'Não foi possível iniciar o reconhecimento de voz. Tente novamente.',
      );
    }
  }

  stop(): void {
    this.cancelled = true;

    if (this.recognition !== null) {
      try {
        this.recognition.abort();
      } catch {
        // O reconhecimento já pode estar encerrado.
      }
    }

    this.statusState.set('ready');
    this.transcriptState.set(null);
    this.errorState.set(null);
  }

  reset(): void {
    this.cancelled = false;
    this.transcriptState.set(null);
    this.errorState.set(null);
    this.statusState.set(
      this.supported ? 'ready' : 'unsupported',
    );
  }

  reportError(message: string): void {
    this.errorState.set(message);
    this.statusState.set('error');
  }

  private configureRecognition(
    recognition: SpeechRecognitionLike,
  ): void {
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const alternative = result?.[0];
      const transcript =
        alternative?.transcript.trim() ?? '';

      if (transcript.length === 0) {
        this.statusState.set('error');
        this.errorState.set(
          'Não consegui compreender o comando. Tente novamente.',
        );
        return;
      }

      this.transcriptState.set(transcript);
      this.errorState.set(null);
      this.statusState.set('recognized');

      try {
        recognition.stop();
      } catch {
        // O navegador pode encerrar automaticamente.
      }
    };

    recognition.onerror = (event) => {
      if (this.cancelled || event.error === 'aborted') {
        this.statusState.set('ready');
        return;
      }

      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        this.statusState.set('permission-denied');
        this.errorState.set(
          'A permissão do microfone foi negada. Libere o acesso nas configurações do navegador ou use os botões de registro.',
        );
        return;
      }

      this.statusState.set('error');

      if (event.error === 'no-speech') {
        this.errorState.set(
          'Nenhuma fala foi identificada. Toque no microfone e tente novamente.',
        );
        return;
      }

      if (event.error === 'audio-capture') {
        this.errorState.set(
          'Nenhum microfone disponível foi encontrado.',
        );
        return;
      }

      this.errorState.set(
        'Não foi possível reconhecer o comando. Tente novamente.',
      );
    };

    recognition.onend = () => {
      if (
        !this.cancelled &&
        this.statusState() === 'listening'
      ) {
        this.statusState.set('error');
        this.errorState.set(
          'Não consegui ouvir o comando. Tente novamente.',
        );
      }
    };
  }

  private getConstructor():
    | SpeechRecognitionConstructor
    | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const speechWindow =
      window as unknown as SpeechRecognitionWindow;

    return (
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition ??
      null
    );
  }
}