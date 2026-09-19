import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { VoicePage } from './voice';
import { VoiceService, VoiceStatus } from '../../core/services/voice';
import { FeedingService } from '../../core/services/feeding';
import { SleepService } from '../../core/services/sleep';
import { DiaperService } from '../../core/services/diaper';

describe('VoicePage: comandos', () => {
  let fixture: ComponentFixture<VoicePage>;

  function createMocks() {
    const transcript = signal<string | null>(null);
    const status = signal<VoiceStatus>('ready');
    const error = signal<string | null>(null);

    return {
      voice: {
        transcript,
        status,
        error,
        supported: true,
        start: jasmine.createSpy('start').and.callFake(() => {
          transcript.set(null);
          error.set(null);
          status.set('listening');
        }),
        stop: jasmine.createSpy('stop').and.callFake(() => {
          transcript.set(null);
          status.set('ready');
        }),
        reportError: jasmine.createSpy('reportError').and.callFake(
          (message: string) => {
            error.set(message);
            status.set('error');
          },
        ),
      },
      feeding: {
        activeFeeding: signal(null),
        storageError: signal<string | null>(null),
        start: jasmine.createSpy('startFeeding'),
        finish: jasmine.createSpy('finishFeeding').and.returnValue(null),
        setSide: jasmine.createSpy('setSide'),
      },
      sleep: {
        activeSleep: signal(null),
        storageError: signal<string | null>(null),
        start: jasmine.createSpy('startSleep'),
        finish: jasmine.createSpy('finishSleep').and.returnValue(null),
      },
      diaper: {
        storageError: signal<string | null>(null),
        register: jasmine.createSpy('registerDiaper'),
        label: jasmine.createSpy('label').and.returnValue('Suja'),
      },
      router: {
        navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      },
    };
  }

  let mocks: ReturnType<typeof createMocks>;

  beforeEach(async () => {
    mocks = createMocks();

    await TestBed.configureTestingModule({
      imports: [VoicePage],
      providers: [
        { provide: VoiceService, useValue: mocks.voice },
        { provide: FeedingService, useValue: mocks.feeding },
        { provide: SleepService, useValue: mocks.sleep },
        { provide: DiaperService, useValue: mocks.diaper },
        { provide: Router, useValue: mocks.router },
      ],
    })
      .overrideComponent(VoicePage, {
        set: { template: '', styles: [], styleUrls: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VoicePage);
    fixture.detectChanges();
  });

  function say(command: string): void {
    fixture.componentInstance.startListening();
    fixture.detectChanges();

    mocks.voice.status.set('recognized');
    mocks.voice.transcript.set(command);
    fixture.detectChanges();
  }

  function expectNoAction(): void {
    expect(mocks.feeding.start).not.toHaveBeenCalled();
    expect(mocks.feeding.finish).not.toHaveBeenCalled();
    expect(mocks.feeding.setSide).not.toHaveBeenCalled();
    expect(mocks.sleep.start).not.toHaveBeenCalled();
    expect(mocks.sleep.finish).not.toHaveBeenCalled();
    expect(mocks.diaper.register).not.toHaveBeenCalled();
    expect(mocks.router.navigate).not.toHaveBeenCalled();
  }

  for (const command of [
    'não registrar mamada',
    'não dormiu',
    'nunca finalizar sono',
    'iniciar sono e registrar mamada',
    'registrar mamada no lado esquerdo e direito',
    'qual é a previsão do tempo',
  ]) {
    it(`não executa ações para "${command}"`, () => {
      say(command);

      expectNoAction();
      expect(mocks.voice.reportError).toHaveBeenCalled();
      expect(fixture.componentInstance.commandExecuted()).toBeFalse();
    });
  }

  it('inicia mamada no lado esquerdo', () => {
    say('Registrar mamada no lado esquerdo.');

    expect(mocks.feeding.start).toHaveBeenCalledTimes(1);
    expect(mocks.feeding.setSide).toHaveBeenCalledOnceWith('left');
    expect(fixture.componentInstance.commandExecuted()).toBeTrue();
  });

  it('inicia sono com acento e pontuação', () => {
    say('Começar sono!');

    expect(mocks.sleep.start).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.commandExecuted()).toBeTrue();
  });

  it('abre fraldas sem registrar uma troca', () => {
    say('abrir fralda');

    expect(mocks.router.navigate).toHaveBeenCalledOnceWith(['/diaper']);
    expect(mocks.diaper.register).not.toHaveBeenCalled();
  });

  for (const type of [
    { spoken: 'molhada', expected: 'wet' },
    { spoken: 'suja', expected: 'dirty' },
    { spoken: 'ambas', expected: 'both' },
  ]) {
    it(`aceita "${type.spoken}" após solicitar o tipo`, () => {
      say('registrar fralda');

      expect(mocks.diaper.register).not.toHaveBeenCalled();

      say(type.spoken);

      expect(mocks.diaper.register)
        .toHaveBeenCalledOnceWith(type.expected);
    });
  }

  for (const command of [
    'fralda suja e molhada',
    'fralda molhada e suja',
  ]) {
    it(`registra ambas para "${command}"`, () => {
      say(command);

      expect(mocks.diaper.register).toHaveBeenCalledOnceWith('both');
    });
  }

  it('não aceita um tipo isolado sem solicitação anterior', () => {
    say('suja');

    expectNoAction();
    expect(mocks.voice.reportError).toHaveBeenCalled();
  });

  it('cancelamento remove a solicitação pendente de tipo', () => {
    say('registrar fralda');
    fixture.componentInstance.cancelListening();
    fixture.detectChanges();

    say('suja');

    expect(mocks.diaper.register).not.toHaveBeenCalled();
  });

  it('avisa quando não existe sono para finalizar', () => {
    say('finalizar sono');

    expect(mocks.sleep.finish).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.commandExecuted()).toBeFalse();
    expect(mocks.voice.error()).toContain('Não existe um sono');
  });

  for (const scenario of [
    { service: 'feeding' as const, command: 'registrar mamada' },
    { service: 'sleep' as const, command: 'iniciar sono' },
    { service: 'diaper' as const, command: 'registrar fralda suja' },
  ]) {
    it(`informa falha ao salvar: ${scenario.service}`, () => {
      mocks[scenario.service].storageError.set('Não foi possível salvar.');

      say(scenario.command);

      expect(fixture.componentInstance.commandExecuted()).toBeFalse();
      expect(mocks.voice.error()).toContain('Não foi possível salvar.');
      expect(mocks.voice.error()).toContain('Confira o histórico');
    });
  }

  it('não repete uma ação em novas verificações da tela', () => {
    say('registrar fralda suja');

    fixture.detectChanges();
    fixture.detectChanges();

    expect(mocks.diaper.register).toHaveBeenCalledTimes(1);
  });
});