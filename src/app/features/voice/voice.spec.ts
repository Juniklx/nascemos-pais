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

      const user = signal<{ uid: string } | null>({ uid: 'user-a' });
      const baby = signal({ id: 'baby-a', name: 'Lucas' });
      const activeBabyId = signal('baby-a');

      return {
        auth: { user },
        babyContext: { baby, activeBabyId },
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

          registerBottle: jasmine.createSpy('registerBottle').and.callFake(
            async (volumeMl: number, recordedAt: number) => ({
              ...feeding, startedAt: recordedAt, endedAt: recordedAt,
              periods: null, bottleMl: volumeMl,
            }),
          ),

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

          startAt: jasmine.createSpy('startAt').and.callFake(
            async (startedAt: number) => ({ ...sleep, startedAt }),
          ),

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
              { provide: AuthService, useValue: mocks.auth },
              { provide: BabyContextService, useValue: mocks.babyContext },
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
      expect(mocks.feeding.registerBottle).not.toHaveBeenCalled();
      expect(mocks.sleep.startAt).not.toHaveBeenCalled();
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

    it('confirma um sono retroativo sem salvar antes da revisão', async () => {
      const heardAt = Date.now();
      await say('Lucas dormiu há quinze minutos');

      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()?.summary).toContain('Lucas');

      await fixture.componentInstance.confirmPending();

      expect(mocks.sleep.startAt).toHaveBeenCalledTimes(1);
      expect(Math.abs(mocks.sleep.startAt.calls.mostRecent().args[0] - (heardAt - 900_000)))
        .toBeLessThan(2_000);
      expect(fixture.componentInstance.pendingCommand()).toBeNull();
    });

    it('aceita "a" transcrito no lugar de "há" e exige confirmação antes de iniciar o sono', async () => {
      const heardAt = Date.now();
      await say('Lucas dormiu a dois minutos');

      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()?.summary).toContain('(há 2 min)');

      await fixture.componentInstance.confirmPending();

      expect(mocks.sleep.startAt).toHaveBeenCalledTimes(1);
      expect(Math.abs(mocks.sleep.startAt.calls.mostRecent().args[0] - (heardAt - 120_000)))
        .toBeLessThan(2_000);
    });

    it('recusa uma duração incompleta mesmo quando "há" é transcrito como "a"', async () => {
      await say('Lucas dormiu a dois');

      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();
      expect(mocks.voice.reportError).toHaveBeenCalled();
    });

    it('confirma "Lucas acordou" antes de finalizar o sono ativo', async () => {
      mocks.sleep.activeSleep.set(sleep);
      mocks.sleep.finish.and.resolveTo({ ...sleep, endedAt: Date.now() });

      await say('Lucas acordou');

      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()?.summary).toContain('Finalizar o sono de Lucas');

      await fixture.componentInstance.confirmPending();

      expect(mocks.sleep.finish).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.pendingCommand()).toBeNull();
    });

    it('não finaliza sono com nome diferente, sem sono ativo ou após cancelar', async () => {
      mocks.sleep.activeSleep.set(sleep);
      await say('Sara acordou');
      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();

      mocks.sleep.activeSleep.set(null);
      await say('Lucas acordou');
      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();

      mocks.sleep.activeSleep.set(sleep);
      await say('Lucas acordou');
      fixture.componentInstance.cancelPending();
      expectNoAction();
    });

    it('não finaliza outro sono se o sono ativo mudar antes da confirmação', async () => {
      mocks.sleep.activeSleep.set(sleep);
      await say('Lucas acordou');

      mocks.sleep.activeSleep.set({ ...sleep, id: 'sleep-2' });
      await fixture.componentInstance.confirmPending();

      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();
      expect(mocks.voice.reportError).toHaveBeenCalled();
    });

    it('cancela uma mamadeira sem gravar e confirma volume em nova tentativa', async () => {
      await say('registrar mamadeira de cento e vinte ml');
      expectNoAction();
      fixture.componentInstance.cancelPending();
      expectNoAction();

      await say('registrar mamadeira de 120 ml');
      await fixture.componentInstance.confirmPending();

      expect(mocks.feeding.registerBottle).toHaveBeenCalledTimes(1);
      expect(mocks.feeding.registerBottle.calls.mostRecent().args[0]).toBe(120);
    });

    it('recusa bebê diferente e mudança de bebê entre ouvir e confirmar', async () => {
      await say('Sara dormiu há 15 minutos');
      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();

      await say('Lucas dormiu há 15 minutos');
      mocks.babyContext.activeBabyId.set('baby-b');
      await fixture.componentInstance.confirmPending();
      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();
    });

    it('não infere volume ausente ou fora do limite', async () => {
      await say('registrar mamadeira');
      expectNoAction();
      await say('registrar mamadeira de 1200 ml');
      expectNoAction();
      expect(fixture.componentInstance.pendingCommand()).toBeNull();
    });

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

    for (const command of ['registrar amamentação', 'registrar mamada']) {
      it(`inicia amamentação com o comando "${command}"`, async () => {
        await say(command);

        expect(mocks.feeding.start).toHaveBeenCalledTimes(1);
        expect(fixture.componentInstance.feedback()).toContain('Amamentação iniciada');
      });
    }

    for (const command of ['abrir amamentação', 'abrir mamada']) {
      it(`abre amamentação com o comando "${command}"`, async () => {
        await say(command);

        expect(mocks.router.navigate).toHaveBeenCalledOnceWith(['/feeding']);
        expect(mocks.feeding.start).not.toHaveBeenCalled();
      });
    }

    for (const command of ['finalizar amamentação', 'finalizar mamada']) {
      it(`finaliza amamentação com o comando "${command}"`, async () => {
        mocks.feeding.activeFeeding.set(feeding);
        mocks.feeding.finish.and.resolveTo({ ...feeding, endedAt: 2000 });

        await say(command);

        expect(mocks.feeding.finish).toHaveBeenCalledTimes(1);
        expect(fixture.componentInstance.feedback()).toContain('Amamentação finalizada');
      });
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
