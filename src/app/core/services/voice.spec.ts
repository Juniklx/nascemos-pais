import { VoiceService } from './voice';

interface ResultEvent {
  resultIndex: number;
  results: Array<Array<{ transcript: string }>>;
}

class FakeRecognition {
  static instances: FakeRecognition[] = [];

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;

  onresult: ((event: ResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  start = jasmine.createSpy('start');
  stop = jasmine.createSpy('stop');
  abort = jasmine.createSpy('abort');

  constructor() {
    FakeRecognition.instances.push(this);
  }
}

describe('VoiceService', () => {
  let service: VoiceService | undefined;

  let originalRecognition: PropertyDescriptor | undefined;
  let originalWebkitRecognition: PropertyDescriptor | undefined;

  function result(transcript: string): ResultEvent {
    return {
      resultIndex: 0,
      results: [[{ transcript }]],
    };
  }

  function setConstructor(
    name: string,
    value: typeof FakeRecognition | undefined,
  ): void {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      value,
    });
  }

  function restore(
    name: string,
    descriptor: PropertyDescriptor | undefined,
  ): void {
    if (descriptor) {
      Object.defineProperty(window, name, descriptor);
    } else {
      Reflect.deleteProperty(window, name);
    }
  }

  beforeEach(() => {
    originalRecognition =
      Object.getOwnPropertyDescriptor(window, 'SpeechRecognition');

    originalWebkitRecognition =
      Object.getOwnPropertyDescriptor(window, 'webkitSpeechRecognition');

    FakeRecognition.instances = [];

    setConstructor('SpeechRecognition', FakeRecognition);
    setConstructor('webkitSpeechRecognition', undefined);
  });

  afterEach(() => {
    service?.stop();
    service = undefined;

    restore('SpeechRecognition', originalRecognition);
    restore('webkitSpeechRecognition', originalWebkitRecognition);
  });

  it('informa falta de suporte antes de ativar o microfone', () => {
    setConstructor('SpeechRecognition', undefined);

    service = new VoiceService();

    expect(service.supported).toBeFalse();
    expect(service.status()).toBe('unsupported');
    expect(service.error()).toContain('não está disponível');

    service.stop();

    expect(service.status()).toBe('unsupported');
  });

  it('aceita a implementação com prefixo webkit', () => {
    setConstructor('SpeechRecognition', undefined);
    setConstructor('webkitSpeechRecognition', FakeRecognition);

    service = new VoiceService();
    service.start();

    expect(service.supported).toBeTrue();
    expect(service.status()).toBe('listening');
  });

  it('publica um resultado reconhecido', () => {
    service = new VoiceService();
    service.start();

    FakeRecognition.instances[0].onresult?.(
      result('  iniciar sono  '),
    );

    expect(service.transcript()).toBe('iniciar sono');
    expect(service.status()).toBe('recognized');
  });

  it('ignora resultado atrasado depois do cancelamento', () => {
    service = new VoiceService();
    service.start();

    const recognition = FakeRecognition.instances[0];
    const lateResult = recognition.onresult!;

    service.stop();
    lateResult(result('registrar fralda suja'));

    expect(recognition.abort).toHaveBeenCalled();
    expect(service.transcript()).toBeNull();
    expect(service.status()).toBe('ready');
  });

  it('callbacks antigos não interferem em uma nova sessão', () => {
    service = new VoiceService();
    service.start();

    const oldRecognition = FakeRecognition.instances[0];
    const lateResult = oldRecognition.onresult!;
    const lateError = oldRecognition.onerror!;
    const lateEnd = oldRecognition.onend!;

    service.stop();
    service.start();

    lateResult(result('registrar mamada'));
    lateError({ error: 'not-allowed' });
    lateEnd();

    expect(service.status()).toBe('listening');
    expect(service.transcript()).toBeNull();
    expect(service.error()).toBeNull();

    FakeRecognition.instances[1].onresult?.(
      result('iniciar sono'),
    );

    expect(service.transcript()).toBe('iniciar sono');
  });

  it('aceita apenas um resultado por sessão', () => {
    service = new VoiceService();
    service.start();

    const callback = FakeRecognition.instances[0].onresult!;

    callback(result('iniciar sono'));
    callback(result('registrar mamada'));

    expect(service.transcript()).toBe('iniciar sono');
  });

  it('informa permissão negada', () => {
    service = new VoiceService();
    service.start();

    FakeRecognition.instances[0].onerror?.({
      error: 'not-allowed',
    });

    expect(service.status()).toBe('permission-denied');
    expect(service.error()).toContain('permissão');
  });

  it('informa quando a sessão termina sem fala', () => {
    service = new VoiceService();
    service.start();

    FakeRecognition.instances[0].onend?.();

    expect(service.status()).toBe('error');
    expect(service.transcript()).toBeNull();
  });
});