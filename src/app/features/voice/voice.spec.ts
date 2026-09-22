import {
  signal,
} from '@angular/core';

import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import {
  Router,
} from '@angular/router';

import type {
  Diaper,
} from '../../core/models/diaper';

import type {
  Feeding,
} from '../../core/models/feeding';

import type {
  Sleep,
} from '../../core/models/sleep';

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
  VoiceStatus,
} from '../../core/services/voice';

import {
  VoicePage,
} from './voice';

describe(
  'VoicePage: comandos',
  () => {
    let fixture:
      ComponentFixture<VoicePage>;

    const feeding:
      Feeding = {
        id:
          'feeding-1',

        startedAt:
          1000,

        endedAt:
          null,

        side:
          null,

        periods: [
          {
            startedAt:
              1000,

            endedAt:
              null,

            side:
              null,
          },
        ],
      };

    const sleep:
      Sleep = {
        id:
          'sleep-1',

        startedAt:
          1000,

        endedAt:
          null,
      };

    const diaper:
      Diaper = {
        id:
          'diaper-1',

        type:
          'dirty',

        recordedAt:
          1000,
      };

    function createMocks() {
      const transcript =
        signal<string | null>(
          null,
        );

      const status =
        signal<VoiceStatus>(
          'ready',
        );

      const error =
        signal<string | null>(
          null,
        );

      const activeFeeding =
        signal<Feeding | null>(
          null,
        );

      const activeSleep =
        signal<Sleep | null>(
          null,
        );

      return {
        voice: {
          transcript,
          status,
          error,

          supported:
            true,

          start:
            jasmine
              .createSpy(
                'start',
              )
              .and.callFake(
                () => {
                  transcript.set(
                    null,
                  );

                  error.set(
                    null,
                  );

                  status.set(
                    'listening',
                  );
                },
              ),

          stop:
            jasmine
              .createSpy(
                'stop',
              )
              .and.callFake(
                () => {
                  transcript.set(
                    null,
                  );

                  status.set(
                    'ready',
                  );
                },
              ),

          reportError:
            jasmine
              .createSpy(
                'reportError',
              )
              .and.callFake(
                (
                  message:
                    string,
                ) => {
                  error.set(
                    message,
                  );

                  status.set(
                    'error',
                  );
                },
              ),
        },

        feeding: {
          activeFeeding,

          storageError:
            signal<
              string | null
            >(null),

          start:
            jasmine
              .createSpy(
                'startFeeding',
              )
              .and.resolveTo(
                feeding,
              ),

          finish:
            jasmine
              .createSpy(
                'finishFeeding',
              )
              .and.resolveTo(
                null,
              ),

          setSide:
            jasmine
              .createSpy(
                'setSide',
              )
              .and.resolveTo(
                true,
              ),
        },

        sleep: {
          activeSleep,

          storageError:
            signal<
              string | null
            >(null),

          start:
            jasmine
              .createSpy(
                'startSleep',
              )
              .and.resolveTo(
                sleep,
              ),

          finish:
            jasmine
              .createSpy(
                'finishSleep',
              )
              .and.resolveTo(
                null,
              ),
        },

        diaper: {
          storageError:
            signal<
              string | null
            >(null),

          register:
            jasmine
              .createSpy(
                'registerDiaper',
              )
              .and.resolveTo(
                diaper,
              ),

          label:
            jasmine
              .createSpy(
                'label',
              )
              .and.returnValue(
                'Suja',
              ),
        },

        router: {
          navigate:
            jasmine
              .createSpy(
                'navigate',
              )
              .and.resolveTo(
                true,
              ),
        },
      };
    }

    let mocks:
      ReturnType<
        typeof createMocks
      >;

    beforeEach(
      async () => {
        mocks =
          createMocks();

        await TestBed
          .configureTestingModule({
            imports: [
              VoicePage,
            ],

            providers: [
              {
                provide:
                  VoiceService,

                useValue:
                  mocks.voice,
              },
              {
                provide:
                  FeedingService,

                useValue:
                  mocks.feeding,
              },
              {
                provide:
                  SleepService,

                useValue:
                  mocks.sleep,
              },
              {
                provide:
                  DiaperService,

                useValue:
                  mocks.diaper,
              },
              {
                provide:
                  Router,

                useValue:
                  mocks.router,
              },
            ],
          })
          .overrideComponent(
            VoicePage,
            {
              set: {
                template:
                  '',

                styles: [],

                styleUrls:
                  [],
              },
            },
          )
          .compileComponents();

        fixture =
          TestBed
            .createComponent(
              VoicePage,
            );

        fixture
          .detectChanges();
      },
    );

    async function say(
      command: string,
    ): Promise<void> {
      fixture
        .componentInstance
        .startListening();

      fixture
        .detectChanges();

      mocks.voice
        .status
        .set(
          'recognized',
        );

      mocks.voice
        .transcript
        .set(
          command,
        );

      fixture
        .detectChanges();

      await fixture
        .whenStable();

      await Promise
        .resolve();

      fixture
        .detectChanges();
    }

    function expectNoAction():
      void {
      expect(
        mocks.feeding
          .start,
      ).not
        .toHaveBeenCalled();

      expect(
        mocks.feeding
          .finish,
      ).not
        .toHaveBeenCalled();

      expect(
        mocks.feeding
          .setSide,
      ).not
        .toHaveBeenCalled();

      expect(
        mocks.sleep
          .start,
      ).not
        .toHaveBeenCalled();

      expect(
        mocks.sleep
          .finish,
      ).not
        .toHaveBeenCalled();

      expect(
        mocks.diaper
          .register,
      ).not
        .toHaveBeenCalled();

      expect(
        mocks.router
          .navigate,
      ).not
        .toHaveBeenCalled();
    }

    for (
      const command of [
        'não registrar mamada',
        'não dormiu',
        'nunca finalizar sono',
        'iniciar sono e registrar mamada',
        'registrar mamada no lado esquerdo e direito',
        'qual é a previsão do tempo',
      ]
    ) {
      it(
        `não executa ações para "${command}"`,
        async () => {
          await say(
            command,
          );

          expectNoAction();

          expect(
            mocks.voice
              .reportError,
          ).toHaveBeenCalled();

          expect(
            fixture
              .componentInstance
              .commandExecuted(),
          ).toBeFalse();
        },
      );
    }

    it(
      'inicia mamada no lado esquerdo',
      async () => {
        await say(
          'Registrar mamada no lado esquerdo.',
        );

        expect(
          mocks.feeding
            .start,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.feeding
            .setSide,
        ).toHaveBeenCalledOnceWith(
          'left',
        );

        expect(
          fixture
            .componentInstance
            .commandExecuted(),
        ).toBeTrue();
      },
    );

    it(
      'inicia sono com acento e pontuação',
      async () => {
        await say(
          'Começar sono!',
        );

        expect(
          mocks.sleep
            .start,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          fixture
            .componentInstance
            .commandExecuted(),
        ).toBeTrue();
      },
    );

    it(
      'abre fraldas sem registrar uma troca',
      async () => {
        await say(
          'abrir fralda',
        );

        expect(
          mocks.router
            .navigate,
        ).toHaveBeenCalledOnceWith([
          '/diaper',
        ]);

        expect(
          mocks.diaper
            .register,
        ).not
          .toHaveBeenCalled();
      },
    );

    for (
      const type of [
        {
          spoken:
            'molhada',

          expected:
            'wet',
        },
        {
          spoken:
            'suja',

          expected:
            'dirty',
        },
        {
          spoken:
            'ambas',

          expected:
            'both',
        },
      ]
    ) {
      it(
        `aceita "${type.spoken}" após solicitar o tipo`,
        async () => {
          await say(
            'registrar fralda',
          );

          expect(
            mocks.diaper
              .register,
          ).not
            .toHaveBeenCalled();

          await say(
            type.spoken,
          );

          expect(
            mocks.diaper
              .register,
          ).toHaveBeenCalledOnceWith(
            type.expected,
          );
        },
      );
    }

    for (
      const command of [
        'fralda suja e molhada',
        'fralda molhada e suja',
      ]
    ) {
      it(
        `registra ambas para "${command}"`,
        async () => {
          await say(
            command,
          );

          expect(
            mocks.diaper
              .register,
          ).toHaveBeenCalledOnceWith(
            'both',
          );
        },
      );
    }

    it(
      'não aceita um tipo isolado sem solicitação anterior',
      async () => {
        await say(
          'suja',
        );

        expectNoAction();

        expect(
          mocks.voice
            .reportError,
        ).toHaveBeenCalled();
      },
    );

    it(
      'cancelamento remove a solicitação pendente de tipo',
      async () => {
        await say(
          'registrar fralda',
        );

        fixture
          .componentInstance
          .cancelListening();

        fixture
          .detectChanges();

        await say(
          'suja',
        );

        expect(
          mocks.diaper
            .register,
        ).not
          .toHaveBeenCalled();
      },
    );

    it(
      'avisa quando não existe sono para finalizar',
      async () => {
        await say(
          'finalizar sono',
        );

        expect(
          mocks.sleep
            .finish,
        ).not
          .toHaveBeenCalled();

        expect(
          fixture
            .componentInstance
            .commandExecuted(),
        ).toBeFalse();

        expect(
          mocks.voice
            .error(),
        ).toContain(
          'Não existe um sono',
        );
      },
    );

    for (
      const scenario of [
        {
          service:
            'feeding' as const,

          command:
            'registrar mamada',
        },
        {
          service:
            'sleep' as const,

          command:
            'iniciar sono',
        },
        {
          service:
            'diaper' as const,

          command:
            'registrar fralda suja',
        },
      ]
    ) {
      it(
        `informa falha ao salvar: ${scenario.service}`,
        async () => {
          mocks[
            scenario.service
          ].storageError.set(
            'Não foi possível sincronizar.',
          );

          if (
            scenario.service ===
            'feeding'
          ) {
            mocks.feeding
              .start
              .and.resolveTo(
                null,
              );
          }

          if (
            scenario.service ===
            'sleep'
          ) {
            mocks.sleep
              .start
              .and.resolveTo(
                null,
              );
          }

          if (
            scenario.service ===
            'diaper'
          ) {
            mocks.diaper
              .register
              .and.resolveTo(
                null,
              );
          }

          await say(
            scenario.command,
          );

          expect(
            fixture
              .componentInstance
              .commandExecuted(),
          ).toBeFalse();

          expect(
            mocks.voice
              .error(),
          ).toContain(
            'Não foi possível sincronizar.',
          );
        },
      );
    }

    it(
      'não repete uma ação em novas verificações da tela',
      async () => {
        await say(
          'registrar fralda suja',
        );

        fixture
          .detectChanges();

        fixture
          .detectChanges();

        await Promise
          .resolve();

        expect(
          mocks.diaper
            .register,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);