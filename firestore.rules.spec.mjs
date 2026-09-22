import { readFileSync } from 'node:fs';

import { after, before, beforeEach, test } from 'node:test';

import assert from 'node:assert/strict';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';

const projectId = 'nascemos-pais';

const userA = 'user-a';

const userB = 'user-b';

const userC = 'user-c';

const sharedBaby = 'baby-shared';

const rules = readFileSync('firestore.rules', 'utf8');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,

    firestore: {
      host: '127.0.0.1',

      port: 8080,

      rules,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, `users/${userA}`), {
      caregiverName: 'Conta A',

      babyName: 'Bebê A',

      babyBirthDate: '2026-01-01',

      consentGiven: true,

      consentAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `users/${userB}`), {
      caregiverName: 'Conta B',

      babyName: 'Bebê B',

      babyBirthDate: '2026-01-02',

      consentGiven: true,

      consentAt: '2026-01-02T00:00:00.000Z',
    });

    await setDoc(doc(db, `users/${userB}/diapers/diaper-b`), {
      id: 'diaper-b',

      type: 'wet',

      recordedAt: 1000,
    });

    await setDoc(doc(db, `babies/${sharedBaby}`), {
      name: 'Bebê compartilhado',

      birthDate: '2026-01-01',

      createdByUid: userA,

      createdAt: '2026-01-01T00:00:00.000Z',

      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `babies/${sharedBaby}/members/${userA}`), {
      role: 'owner',

      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `babies/${sharedBaby}/members/${userB}`), {
      role: 'caregiver',

      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `babies/${sharedBaby}/diapers/shared-diaper`), {
      id: 'shared-diaper',

      type: 'wet',

      recordedAt: 1000,
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('nega leitura sem autenticação', async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(db, `users/${userA}`)));
});

test('permite usuário ler o próprio perfil', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  const snapshot = await assertSucceeds(getDoc(doc(db, `users/${userA}`)));

  assert.equal(snapshot.exists(), true);
});

test('nega usuário A lendo perfil do usuário B', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(getDoc(doc(db, `users/${userB}`)));
});

test('nega usuário A lendo registros do usuário B', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(getDoc(doc(db, `users/${userB}/diapers/diaper-b`)));
});

test('nega usuário A gravando registro no usuário B', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(
    setDoc(doc(db, `users/${userB}/diapers/teste-seguranca`), {
      id: 'teste-seguranca',

      type: 'wet',

      recordedAt: 1000,
    }),
  );
});

test('nega documento inválido mesmo no próprio usuário', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(
    setDoc(doc(db, `users/${userA}/diapers/teste-invalido`), {
      id: 'id-diferente',

      type: 'qualquer-coisa',

      recordedAt: 1000,
    }),
  );
});

test('permite proprietário ler bebê compartilhado', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  const snapshot = await assertSucceeds(getDoc(doc(db, `babies/${sharedBaby}`)));

  assert.equal(snapshot.exists(), true);
});

test('permite responsável ler bebê compartilhado', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  const snapshot = await assertSucceeds(getDoc(doc(db, `babies/${sharedBaby}`)));

  assert.equal(snapshot.exists(), true);
});

test('permite responsável criar registro compartilhado', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertSucceeds(
    setDoc(doc(db, `babies/${sharedBaby}/diapers/diaper-caregiver`), {
      id: 'diaper-caregiver',

      type: 'dirty',

      recordedAt: 2000,
    }),
  );
});

test('nega acesso ao bebê para usuário sem vínculo', async () => {
  const db = testEnv.authenticatedContext(userC).firestore();

  await assertFails(getDoc(doc(db, `babies/${sharedBaby}`)));
});

test('nega acesso aos registros para usuário sem vínculo', async () => {
  const db = testEnv.authenticatedContext(userC).firestore();

  await assertFails(getDoc(doc(db, `babies/${sharedBaby}/diapers/shared-diaper`)));
});

test('nega responsável adicionando outro responsável', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertFails(
    setDoc(doc(db, `babies/${sharedBaby}/members/${userC}`), {
      role: 'caregiver',

      joinedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
});

test('permite proprietário adicionar responsável', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  await assertSucceeds(
    setDoc(doc(ownerDb, `babies/${sharedBaby}/members/${userC}`), {
      role: 'caregiver',

      joinedAt: '2026-01-01T00:00:00.000Z',
    }),
  );

  const caregiverDb = testEnv.authenticatedContext(userC).firestore();

  await assertSucceeds(getDoc(doc(caregiverDb, `babies/${sharedBaby}`)));
});

test('responsável removido perde acesso ao bebê', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  await assertSucceeds(deleteDoc(doc(ownerDb, `babies/${sharedBaby}/members/${userB}`)));

  const caregiverDb = testEnv.authenticatedContext(userB).firestore();

  await assertFails(getDoc(doc(caregiverDb, `babies/${sharedBaby}`)));

  await assertFails(getDoc(doc(caregiverDb, `babies/${sharedBaby}/diapers/shared-diaper`)));
});

test('permite criar bebê e proprietário no mesmo lote', async () => {
  const db = testEnv.authenticatedContext(userC).firestore();

  const babyId = 'baby-created-by-c';

  const batch = writeBatch(db);

  batch.set(doc(db, `babies/${babyId}`), {
    name: 'Novo bebê',

    birthDate: '2026-02-01',

    createdByUid: userC,

    createdAt: '2026-02-01T00:00:00.000Z',

    updatedAt: '2026-02-01T00:00:00.000Z',
  });

  batch.set(doc(db, `babies/${babyId}/members/${userC}`), {
    role: 'owner',

    joinedAt: '2026-02-01T00:00:00.000Z',
  });

  await assertSucceeds(batch.commit());
});
