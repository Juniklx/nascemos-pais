import {
  signal,
} from '@angular/core';

import {
  TestBed,
} from '@angular/core/testing';

import {
  User,
} from 'firebase/auth';

import {
  FirestoreGateway,
} from '../firebase/firestore.gateway';

import {
  AuthService,
} from './auth';

import {
  UserDataRepository,
} from './user-data.repository';

describe(
  'UserDataRepository',
  () => {
    let repository:
      UserDataRepository;

    const user =
      signal<User | null>(
        {
          uid:
            'user-a',
        } as User,
      );

    const firestore = {
      get:
        jasmine
          .createSpy(
            'get',
          ),

      list:
        jasmine
          .createSpy(
            'list',
          ),

      set:
        jasmine
          .createSpy(
            'set',
          ),

      delete:
        jasmine
          .createSpy(
            'delete',
          ),

      batchSet:
        jasmine
          .createSpy(
            'batchSet',
          ),
    };

    beforeEach(() => {
      user.set(
        {
          uid:
            'user-a',
        } as User,
      );

      firestore
        .get
        .calls
        .reset();

      firestore
        .list
        .calls
        .reset();

      firestore
        .set
        .calls
        .reset();

      firestore
        .delete
        .calls
        .reset();

      firestore
        .batchSet
        .calls
        .reset();

      firestore
        .get
        .and.resolveTo(
          null,
        );

      firestore
        .list
        .and.resolveTo(
          [],
        );

      firestore
        .set
        .and.resolveTo();

      firestore
        .delete
        .and.resolveTo();

      firestore
        .batchSet
        .and.resolveTo();

      TestBed
        .configureTestingModule({
          providers: [
            UserDataRepository,

            {
              provide:
                AuthService,

              useValue: {
                user:
                  user
                    .asReadonly(),
              },
            },

            {
              provide:
                FirestoreGateway,

              useValue:
                firestore,
            },
          ],
        });

      repository =
        TestBed.inject(
          UserDataRepository,
        );
    });

    it(
      'lê o perfil do usuário autenticado',
      async () => {
        firestore
          .get
          .and.resolveTo({
            caregiverName:
              'Marcelo',
          });

        await repository
          .readProfile();

        expect(
          firestore.get,
        ).toHaveBeenCalledOnceWith(
          'users/user-a',
        );
      },
    );

    it(
      'salva registro dentro do uid do usuário',
      async () => {
        const record = {
          id:
            'feeding-1',

          startedAt:
            1000,

          endedAt:
            2000,
        };

        await repository
          .saveRecord(
            'feedings',
            record,
          );

        expect(
          firestore.set,
        ).toHaveBeenCalledOnceWith(
          'users/user-a/feedings/feeding-1',
          record,
          true,
        );
      },
    );

    it(
      'troca o caminho quando muda o usuário antes da operação',
      async () => {
        user.set(
          {
            uid:
              'user-b',
          } as User,
        );

        const record = {
          id:
            'diaper-1',

          type:
            'wet',

          recordedAt:
            1000,
        };

        await repository
          .saveRecord(
            'diapers',
            record,
          );

        expect(
          firestore.set,
        ).toHaveBeenCalledOnceWith(
          'users/user-b/diapers/diaper-1',
          record,
          true,
        );
      },
    );

    it(
      'impede acesso sem usuário autenticado',
      async () => {
        user.set(
          null,
        );

        await expectAsync(
          repository
            .readProfile(),
        ).toBeRejectedWithError(
          'Usuário não autenticado.',
        );

        expect(
          firestore.get,
        ).not
          .toHaveBeenCalled();
      },
    );

    it(
      'detecta troca de sessão durante uma gravação',
      async () => {
        const record = {
          id:
            'feeding-1',

          startedAt:
            1000,

          endedAt:
            2000,
        };

        firestore
          .set
          .and.callFake(
            async () => {
              user.set(
                {
                  uid:
                    'user-b',
                } as User,
              );
            },
          );

        await expectAsync(
          repository
            .saveRecord(
              'feedings',
              record,
            ),
        ).toBeRejectedWithError(
          'A sessão mudou durante a operação.',
        );

        /*
         * Mesmo tendo ocorrido a troca,
         * o caminho foi calculado com
         * o UID originalmente capturado.
         */
        expect(
          firestore.set,
        ).toHaveBeenCalledOnceWith(
          'users/user-a/feedings/feeding-1',
          record,
          true,
        );
      },
    );

    it(
      'interrompe migração em lotes se a sessão mudar',
      async () => {
        const records =
          Array.from(
            {
              length:
                401,
            },

            (
              _,
              index,
            ) => ({
              id:
                `feeding-${index}`,

              startedAt:
                index,

              endedAt:
                index + 1,
            }),
          );

        firestore
          .batchSet
          .and.callFake(
            async () => {
              user.set(
                {
                  uid:
                    'user-b',
                } as User,
              );
            },
          );

        await expectAsync(
          repository
            .saveRecords(
              'feedings',
              records,
            ),
        ).toBeRejectedWithError(
          'A sessão mudou durante a operação.',
        );

        /*
         * A troca foi percebida após o
         * primeiro lote; nenhum segundo
         * lote pôde ser enviado para
         * outra conta.
         */
        expect(
          firestore
            .batchSet,
        ).toHaveBeenCalledTimes(
          1,
        );

        const firstBatch =
          firestore
            .batchSet
            .calls
            .mostRecent()
            .args[0] as Array<{
              path: string;
            }>;

        expect(
          firstBatch.length,
        ).toBe(
          400,
        );

        expect(
          firstBatch.every(
            (entry) =>
              entry.path
                .startsWith(
                  'users/user-a/feedings/',
                ),
          ),
        ).toBeTrue();
      },
    );
  },
);