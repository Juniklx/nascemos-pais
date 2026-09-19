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
  readonly supported = this.getConstructor() !== null;

  private readonly unsupportedMessage =
    'O reconhecimento de voz não está disponível neste navegador. Use os botões de registro.';

  private readonly statusState = signal<VoiceStatus>(
    this.supported ? 'ready' : 'unsupported',
  );

  private readonly transcriptState =
    signal<string | null>(null);

  private readonly errorState = signal<string | null>(
    this.supported ? null : this.unsupportedMessage,
  );

  private recognition: SpeechRecognitionLike | null = null;
  private sessionId = 0;

  readonly status = this.statusState.asReadonly();
  readonly transcript = this.transcriptState.asReadonly();
  readonly error = this.errorState.asReadonly();

  start(): void {
    if (this.statusState() === 'listening') {
      return;
    }

    this.releaseRecognition();
    this.transcriptState.set(null);
    this.errorState.set(null);

    const Recognition = this.getConstructor();

    if (Recognition === null) {
      this.statusState.set('unsupported');
      this.errorState.set(this.unsupportedMessage);
      return;
    }

    const sessionId = this.sessionId;

    try {
      const recognition = new Recognition();

      this.recognition = recognition;
      this.configureRecognition(recognition, sessionId);
      this.statusState.set('listening');

      recognition.start();
    } catch {
      this.releaseRecognition();
      this.statusState.set('error');
      this.errorState.set(
        'Não foi possível iniciar o reconhecimento de voz. Tente novamente.',
      );
    }
  }

  stop(): void {
    this.releaseRecognition();
    this.transcriptState.set(null);

    this.statusState.set(
      this.supported ? 'ready' : 'unsupported',
    );

    this.errorState.set(
      this.supported ? null : this.unsupportedMessage,
    );
  }

  reset(): void {
    this.stop();
  }

  reportError(message: string): void {
    this.releaseRecognition();
    this.errorState.set(message);
    this.statusState.set('error');
  }

  private releaseRecognition(): void {
    // Invalida os callbacks da sessão anterior.
    this.sessionId += 1;

    const recognition = this.recognition;
    this.recognition = null;

    if (recognition === null) {
      return;
    }

    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    try {
      recognition.abort();
    } catch {
      // O reconhecimento já pode ter sido encerrado.
    }
  }

  private configureRecognition(
    recognition: SpeechRecognitionLike,
    sessionId: number,
  ): void {
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const isCurrentSession = (): boolean =>
      this.sessionId === sessionId &&
      this.recognition === recognition;

    recognition.onresult = (event) => {
      if (!isCurrentSession()) {
        return;
      }

      const result = event.results[event.resultIndex];
      const transcript = result?.[0]?.transcript.trim() ?? '';

      // Aceita somente um resultado por sessão.
      this.releaseRecognition();

      if (transcript.length === 0) {
        this.statusState.set('error');
        this.errorState.set(
          'Não consegui compreender o comando. Tente novamente.',
        );
        return;
      }

      this.errorState.set(null);
      this.statusState.set('recognized');
      this.transcriptState.set(transcript);
    };

    recognition.onerror = (event) => {
      if (!isCurrentSession()) {
        return;
      }

      this.releaseRecognition();

      if (event.error === 'aborted') {
        this.statusState.set('ready');
        this.errorState.set(null);
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

      if (event.error === 'network') {
        this.errorState.set(
          'O serviço de reconhecimento apresentou um erro de conexão. Verifique sua internet e tente novamente.',
        );
        return;
      }

      this.errorState.set(
        'Não foi possível reconhecer o comando. Tente novamente.',
      );
    };

    recognition.onend = () => {
      if (!isCurrentSession()) {
        return;
      }

      this.releaseRecognition();

      if (this.statusState() === 'listening') {
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