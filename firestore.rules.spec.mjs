import {
  readFileSync,
} from 'node:fs';

import {
  after,
  before,
  beforeEach,
  test,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

const projectId =
  'nascemos-pais';

const userA =
  'user-a';

const userB =
  'user-b';

const rules =
  readFileSync(
    'firestore.rules',
    'utf8',
  );

let testEnv;

before(
  async () => {
    testEnv =
      await initializeTestEnvironment({
        projectId,

        firestore: {
          host:
            '127.0.0.1',

          port:
            8080,

          rules,
        },
      });
  },
);

beforeEach(
  async () => {
    await testEnv
      .clearFirestore();

    await testEnv
      .withSecurityRulesDisabled(
        async (context) => {
          const db =
            context.firestore();

          await setDoc(
            doc(
              db,
              `users/${userA}`,
            ),
            {
              caregiverName:
                'Conta A',

              babyName:
                'Bebê A',

              babyBirthDate:
                '2026-01-01',

              consentGiven:
                true,

              consentAt:
                '2026-01-01T00:00:00.000Z',
            },
          );

          await setDoc(
            doc(
              db,
              `users/${userB}`,
            ),
            {
              caregiverName:
                'Conta B',

              babyName:
                'Bebê B',

              babyBirthDate:
                '2026-01-02',

              consentGiven:
                true,

              consentAt:
                '2026-01-02T00:00:00.000Z',
            },
          );

          await setDoc(
            doc(
              db,
              `users/${userB}/diapers/diaper-b`,
            ),
            {
              id:
                'diaper-b',

              type:
                'wet',

              recordedAt:
                1000,
            },
          );
        },
      );
  },
);

after(
  async () => {
    await testEnv
      .cleanup();
  },
);

test(
  'nega leitura sem autenticação',
  async () => {
    const db =
      testEnv
        .unauthenticatedContext()
        .firestore();

    await assertFails(
      getDoc(
        doc(
          db,
          `users/${userA}`,
        ),
      ),
    );
  },
);

test(
  'permite usuário ler o próprio perfil',
  async () => {
    const db =
      testEnv
        .authenticatedContext(
          userA,
        )
        .firestore();

    const snapshot =
      await assertSucceeds(
        getDoc(
          doc(
            db,
            `users/${userA}`,
          ),
        ),
      );

    assert.equal(
      snapshot.exists(),
      true,
    );
  },
);

test(
  'nega usuário A lendo perfil do usuário B',
  async () => {
    const db =
      testEnv
        .authenticatedContext(
          userA,
        )
        .firestore();

    await assertFails(
      getDoc(
        doc(
          db,
          `users/${userB}`,
        ),
      ),
    );
  },
);

test(
  'nega usuário A lendo registros do usuário B',
  async () => {
    const db =
      testEnv
        .authenticatedContext(
          userA,
        )
        .firestore();

    await assertFails(
      getDoc(
        doc(
          db,
          `users/${userB}/diapers/diaper-b`,
        ),
      ),
    );
  },
);

test(
  'nega usuário A gravando registro no usuário B',
  async () => {
    const db =
      testEnv
        .authenticatedContext(
          userA,
        )
        .firestore();

    await assertFails(
      setDoc(
        doc(
          db,
          `users/${userB}/diapers/teste-seguranca`,
        ),
        {
          id:
            'teste-seguranca',

          type:
            'wet',

          recordedAt:
            1000,
        },
      ),
    );
  },
);

test(
  'nega documento inválido mesmo no próprio usuário',
  async () => {
    const db =
      testEnv
        .authenticatedContext(
          userA,
        )
        .firestore();

    await assertFails(
      setDoc(
        doc(
          db,
          `users/${userA}/diapers/teste-invalido`,
        ),
        {
          id:
            'id-diferente',

          type:
            'qualquer-coisa',

          recordedAt:
            1000,
        },
      ),
    );
  },
);