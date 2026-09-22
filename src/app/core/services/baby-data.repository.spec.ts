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
  BabyDataRepository,
} from './baby-data.repository';

describe(
  'BabyDataRepository',
  () => {
    let repository:
      BabyDataRepository;

    const user =
      signal<User | null>(
        {
          uid:
            'user-a',
        } as User,
      );

    const firestore = {
      createId:
        jasmine.createSpy(
          'createId',
        ),

      get:
        jasmine.createSpy(
          'get',
        ),

      list:
        jasmine.createSpy(
          'list',
        ),

      set:
        jasmine.createSpy(
          'set',
        ),

      delete:
        jasmine.createSpy(
          'delete',
        ),

      batchSet:
        jasmine.createSpy(
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
        .createId
        .calls.reset();

      firestore
        .get
        .calls.reset();

      firestore
        .list
        .calls.reset();

      firestore
        .set
        .calls.reset();

      firestore
        .delete
        .calls.reset();

      firestore
        .batchSet
        .calls.reset();

      firestore
        .createId
        .and.returnValue(
          'baby-1',
        );

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
            BabyDataRepository,

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
          BabyDataRepository,
        );
    });

    it(
      'cria bebê e proprietário no mesmo lote',
      async () => {
        const baby =
          await repository
            .createOwnedBaby({
              name:
                'Helena',

              birthDate:
                '2026-01-01',
            });

        expect(
          firestore
            .createId,
        ).toHaveBeenCalledOnceWith(
          'babies',
        );

        expect(
          baby.id,
        ).toBe(
          'baby-1',
        );

        expect(
          baby.createdByUid,
        ).toBe(
          'user-a',
        );

        const entries =
          firestore
            .batchSet
            .calls
            .mostRecent()
            .args[0];

        expect(
          entries.length,
        ).toBe(3);

        expect(
          entries[0].path,
        ).toBe(
          'babies/baby-1',
        );

        expect(
          entries[0].data,
        ).toEqual(
          jasmine.objectContaining({
            name:
              'Helena',

            birthDate:
              '2026-01-01',

            createdByUid:
              'user-a',
          }),
        );

        expect(
          entries[1].path,
        ).toBe(
          'babies/baby-1/members/user-a',
        );

        expect(
          entries[1].data,
        ).toEqual(
          jasmine.objectContaining({
            role:
              'owner',
          }),
        );

        expect(
          entries[2].path,
        ).toBe(
          'users/user-a',
        );

        expect(
          entries[2].data,
        ).toEqual({
          activeBabyId:
            'baby-1',
        });
      },
    );

    it(
      'lê bebê pelo identificador',
      async () => {
        firestore
          .get
          .and.resolveTo({
            name:
              'Helena',

            birthDate:
              '2026-01-01',

            createdByUid:
              'user-a',

            createdAt:
              '2026-01-01T00:00:00.000Z',

            updatedAt:
              '2026-01-01T00:00:00.000Z',
          });

        const baby =
          await repository
            .readBaby(
              'baby-1',
            );

        expect(
          firestore.get,
        ).toHaveBeenCalledOnceWith(
          'babies/baby-1',
        );

        expect(
          baby?.id,
        ).toBe(
          'baby-1',
        );
      },
    );

    it(
      'lê vínculo do usuário atual',
      async () => {
        firestore
          .get
          .and.resolveTo({
            role:
              'caregiver',

            joinedAt:
              '2026-01-01T00:00:00.000Z',
          });

        const member =
          await repository
            .readMembership(
              'baby-1',
            );

        expect(
          firestore.get,
        ).toHaveBeenCalledOnceWith(
          'babies/baby-1/members/user-a',
        );

        expect(
          member?.role,
        ).toBe(
          'caregiver',
        );
      },
    );

    it(
      'lista registros dentro do bebê',
      async () => {
        await repository
          .listRecords(
            'baby-1',
            'feedings',
          );

        expect(
          firestore.list,
        ).toHaveBeenCalledOnceWith(
          'babies/baby-1/feedings',
        );
      },
    );

    it(
      'salva registro dentro do bebê',
      async () => {
        const record = {
          id:
            'feeding-1',

          startedAt:
            1000,

          endedAt:
            2000,

          side:
            'left',

          periods:
            null,
        };

        await repository
          .saveRecord(
            'baby-1',
            'feedings',
            record,
          );

        expect(
          firestore.set,
        ).toHaveBeenCalledOnceWith(
          'babies/baby-1/feedings/feeding-1',
          record,
          true,
        );
      },
    );

    it(
      'impede operação sem autenticação',
      async () => {
        user.set(null);

        await expectAsync(
          repository
            .readBaby(
              'baby-1',
            ),
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
      'detecta troca de sessão durante gravação',
      async () => {
        const record = {
          id:
            'diaper-1',

          type:
            'wet',

          recordedAt:
            1000,
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
              'baby-1',
              'diapers',
              record,
            ),
        ).toBeRejectedWithError(
          'A sessão mudou durante a operação.',
        );

        expect(
          firestore.set,
        ).toHaveBeenCalledOnceWith(
          'babies/baby-1/diapers/diaper-1',
          record,
          true,
        );
      },
    );
  },
);