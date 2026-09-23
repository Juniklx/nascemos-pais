import { readFileSync } from 'node:fs';

import { after, before, beforeEach, test } from 'node:test';

import assert from 'node:assert/strict';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

const projectId = 'nascemos-pais';

const userA = 'user-a';

const userB = 'user-b';

const userC = 'user-c';

const sharedBaby = 'baby-shared';

const inviteToken = 'invite-token-12345678901234567890123456789012';

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

    await setDoc(doc(db, `users/${userC}`), {
      caregiverName: 'Conta C',

      babyName: 'Bebê C',

      babyBirthDate: '2026-01-03',

      consentGiven: true,

      consentAt: '2026-01-03T00:00:00.000Z',
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

async function createPendingInvite(token = inviteToken) {
  const db = testEnv.authenticatedContext(userA).firestore();

  const expiresAt = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);

  await assertSucceeds(
    setDoc(doc(db, `babyInvites/${token}`), {
      babyId: sharedBaby,

      createdByUid: userA,

      createdAt: serverTimestamp(),

      expiresAt,

      status: 'pending',
    }),
  );
}

function createAcceptanceBatch(db, token = inviteToken) {
  const batch = writeBatch(db);

  batch.set(
    doc(db, `babyInvites/${token}`),
    {
      status: 'accepted',

      acceptedByUid: userC,

      acceptedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  batch.set(doc(db, `babies/${sharedBaby}/members/${userC}`), {
    role: 'caregiver',
    joinedAt: new Date().toISOString(),
    inviteId: token,
    caregiverName: 'Conta C',
  });

  batch.set(
    doc(db, `users/${userC}`),
    {
      activeBabyId: sharedBaby,
    },
    {
      merge: true,
    },
  );

  return batch;
}

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

test('permite concluir migração do bebê no próprio perfil', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertSucceeds(
    setDoc(
      doc(db, `users/${userA}`),
      {
        activeBabyId: sharedBaby,

        babyMigrationVersion: 1,

        babyMigratedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        merge: true,
      },
    ),
  );
});

test('permite proprietário criar convite', async () => {
  await createPendingInvite();

  const db = testEnv.authenticatedContext(userA).firestore();

  const snapshot = await assertSucceeds(getDoc(doc(db, `babyInvites/${inviteToken}`)));

  assert.equal(snapshot.exists(), true);

  assert.equal(snapshot.data().status, 'pending');

  assert.equal(snapshot.data().babyId, sharedBaby);
});

test('nega responsável criando convite', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  const token = `${inviteToken}-b`;

  await assertFails(
    setDoc(doc(db, `babyInvites/${token}`), {
      babyId: sharedBaby,

      createdByUid: userB,

      createdAt: serverTimestamp(),

      expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),

      status: 'pending',
    }),
  );
});

test('nega listagem de convites', async () => {
  await createPendingInvite();

  const db = testEnv.authenticatedContext(userC).firestore();

  await assertFails(getDocs(collection(db, 'babyInvites')));
});

test('nega usuário adicionando a si próprio sem convite', async () => {
  const db = testEnv.authenticatedContext(userC).firestore();

  await assertFails(
    setDoc(doc(db, `babies/${sharedBaby}/members/${userC}`), {
      role: 'caregiver',

      joinedAt: new Date().toISOString(),
    }),
  );
});

test('permite aceitar convite em operação atômica', async () => {
  await createPendingInvite();

  const caregiverDb = testEnv.authenticatedContext(userC).firestore();

  const batch = createAcceptanceBatch(caregiverDb);

  await assertSucceeds(batch.commit());

  const membership = await assertSucceeds(
    getDoc(doc(caregiverDb, `babies/${sharedBaby}/members/${userC}`)),
  );

  assert.equal(membership.exists(), true);

  assert.equal(membership.data().role, 'caregiver');

  assert.equal(membership.data().inviteId, inviteToken);

  const invite = await assertSucceeds(getDoc(doc(caregiverDb, `babyInvites/${inviteToken}`)));

  assert.equal(invite.data().status, 'accepted');

  assert.equal(invite.data().acceptedByUid, userC);

  const profile = await assertSucceeds(getDoc(doc(caregiverDb, `users/${userC}`)));

  assert.equal(profile.data().activeBabyId, sharedBaby);

  const baby = await assertSucceeds(getDoc(doc(caregiverDb, `babies/${sharedBaby}`)));

  assert.equal(baby.exists(), true);
});

test('nega aceitar convite sem nome do responsável no vínculo', async () => {
  await createPendingInvite();

  const db = testEnv.authenticatedContext(userC).firestore();

  const batch = writeBatch(db);

  batch.set(
    doc(db, `babyInvites/${inviteToken}`),
    {
      status: 'accepted',
      acceptedByUid: userC,
      acceptedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  batch.set(doc(db, `babies/${sharedBaby}/members/${userC}`), {
    role: 'caregiver',
    joinedAt: new Date().toISOString(),
    inviteId: inviteToken,
  });

  batch.set(
    doc(db, `users/${userC}`),
    {
      activeBabyId: sharedBaby,
    },
    {
      merge: true,
    },
  );

  await assertFails(batch.commit());
});

test('nega aceitação de convite expirado', async () => {
  const expiredToken = `${inviteToken}-expired`;

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    const now = Date.now();

    await setDoc(doc(db, `babyInvites/${expiredToken}`), {
      babyId: sharedBaby,

      createdByUid: userA,

      createdAt: Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),

      expiresAt: Timestamp.fromMillis(now - 1000),

      status: 'pending',
    });
  });

  const db = testEnv.authenticatedContext(userC).firestore();

  const batch = createAcceptanceBatch(db, expiredToken);

  await assertFails(batch.commit());

  await assertFails(getDoc(doc(db, `babies/${sharedBaby}`)));
});

test('nega reutilização de convite já aceito', async () => {
  await createPendingInvite();

  const caregiverDb = testEnv.authenticatedContext(userC).firestore();

  const firstBatch = createAcceptanceBatch(caregiverDb);

  await assertSucceeds(firstBatch.commit());

  /*
   * O proprietário remove userC.
   */
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  await assertSucceeds(deleteDoc(doc(ownerDb, `babies/${sharedBaby}/members/${userC}`)));

  /*
   * Mesmo possuindo o token antigo,
   * userC não pode utilizá-lo novamente,
   * pois o convite já está accepted.
   */
  const secondBatch = createAcceptanceBatch(caregiverDb);

  await assertFails(secondBatch.commit());

  /*
   * Conferimos como administrador que
   * o segundo batch não recriou o vínculo.
   */
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    const membership = await getDoc(doc(adminDb, `babies/${sharedBaby}/members/${userC}`));

    assert.equal(membership.exists(), false);

    const invite = await getDoc(doc(adminDb, `babyInvites/${inviteToken}`));

    assert.equal(invite.exists(), true);

    assert.equal(invite.data().status, 'accepted');

    assert.equal(invite.data().acceptedByUid, userC);
  });
});

test('nega consumir convite sem criar vínculo de responsável', async () => {
  await createPendingInvite();

  const db = testEnv.authenticatedContext(userC).firestore();

  /*
   * Tentamos alterar somente o convite.
   * Não criamos members/{userC} e não
   * atualizamos activeBabyId.
   */
  await assertFails(
    setDoc(
      doc(db, `babyInvites/${inviteToken}`),
      {
        status: 'accepted',

        acceptedByUid: userC,

        acceptedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    ),
  );

  /*
   * O convite precisa continuar pendente.
   */
  const invite = await assertSucceeds(getDoc(doc(db, `babyInvites/${inviteToken}`)));

  assert.equal(invite.data().status, 'pending');

  /*
   * E nenhum vínculo pode ter sido criado.
   */
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    const membership = await getDoc(doc(adminDb, `babies/${sharedBaby}/members/${userC}`));

    assert.equal(membership.exists(), false);
  });
});
