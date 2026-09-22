import {
  TestBed,
} from '@angular/core/testing';

import {
  activityReadyGuard,
} from './activity-ready.guard';

import {
  ActivityPersistenceService,
} from '../services/activity-persistence';

describe(
  'activityReadyGuard',
  () => {
    it(
      'aguarda o carregamento dos registros',
      async () => {
        const persistence = {
          load:
            jasmine
              .createSpy(
                'load',
              )
              .and.resolveTo({
                feedings: [],
                sleeps: [],
                diapers: [],
              }),
        };

        TestBed
          .configureTestingModule({
            providers: [
              {
                provide:
                  ActivityPersistenceService,

                useValue:
                  persistence,
              },
            ],
          });

        const result =
          await TestBed
            .runInInjectionContext(
              () =>
                activityReadyGuard(
                  {} as never,
                  {} as never,
                ),
            );

        expect(
          result,
        ).toBeTrue();

        expect(
          persistence.load,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'permite a navegação quando o carregamento falha para a interface exibir o erro',
      async () => {
        const persistence = {
          load:
            jasmine
              .createSpy(
                'load',
              )
              .and.rejectWith(
                new Error(
                  'Firestore indisponível',
                ),
              ),
        };

        TestBed
          .configureTestingModule({
            providers: [
              {
                provide:
                  ActivityPersistenceService,

                useValue:
                  persistence,
              },
            ],
          });

        const result =
          await TestBed
            .runInInjectionContext(
              () =>
                activityReadyGuard(
                  {} as never,
                  {} as never,
                ),
            );

        expect(
          result,
        ).toBeTrue();

        expect(
          persistence.load,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);