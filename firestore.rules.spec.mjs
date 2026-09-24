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
  deleteField,
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

      babyName: '',

      babyBirthDate: '',

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

    await setDoc(doc(db, `users/${userA}/babies/${sharedBaby}`), {
      role: 'owner',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `users/${userB}/babies/${sharedBaby}`), {
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

function createAcceptanceBatch(db, token = inviteToken, profilePatch = {}) {
  const batch = writeBatch(db);
  const joinedAt = new Date().toISOString();

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
    joinedAt,
    inviteId: token,
    caregiverName: 'Conta C',
  });

  batch.set(doc(db, `users/${userC}/babies/${sharedBaby}`), {
    role: 'caregiver',
    joinedAt,
  });

  batch.set(
    doc(db, `users/${userC}`),
    {
      activeBabyId: sharedBaby,
      ...profilePatch,
    },
    {
      merge: true,
    },
  );

  return batch;
}

function createAccessRemovalBatch(db, memberId = userB) {
  const batch = writeBatch(db);

  batch.set(doc(db, `users/${memberId}/notifications/baby-access-removed-${sharedBaby}`), {
    type: 'baby-access-removed',
    babyId: sharedBaby,
    babyName: 'Bebê compartilhado',
    createdAt: serverTimestamp(),
    readAt: null,
  });

  batch.delete(doc(db, `babies/${sharedBaby}/members/${memberId}`));
  batch.delete(doc(db, `users/${memberId}/babies/${sharedBaby}`));

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

test('permite usuário listar apenas os próprios vínculos de bebês', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  const snapshot = await assertSucceeds(getDocs(collection(db, `users/${userA}/babies`)));

  assert.equal(snapshot.docs.length, 1);
  assert.equal(snapshot.docs[0].id, sharedBaby);
});

test('nega usuário lendo vínculos de bebês de outra conta', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(getDocs(collection(db, `users/${userB}/babies`)));
});

test('nega criar referência de bebê sem vínculo correspondente', async () => {
  const db = testEnv.authenticatedContext(userC).firestore();

  await assertFails(
    setDoc(doc(db, `users/${userC}/babies/${sharedBaby}`), {
      role: 'caregiver',
      joinedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
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

test('responsável removido recebe notificação e perde acesso ao bebê', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  const batch = createAccessRemovalBatch(ownerDb);

  await assertSucceeds(batch.commit());

  const caregiverDb = testEnv.authenticatedContext(userB).firestore();

  const notification = await assertSucceeds(
    getDoc(doc(caregiverDb, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`)),
  );

  assert.equal(notification.exists(), true);
  assert.equal(notification.data().type, 'baby-access-removed');
  assert.equal(notification.data().babyId, sharedBaby);
  assert.equal(notification.data().babyName, 'Bebê compartilhado');
  assert.equal(notification.data().readAt, null);

  await assertFails(getDoc(doc(caregiverDb, `babies/${sharedBaby}`)));

  await assertFails(getDoc(doc(caregiverDb, `babies/${sharedBaby}/diapers/shared-diaper`)));
});

test('nega proprietário removendo responsável sem notificação', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(deleteDoc(doc(db, `babies/${sharedBaby}/members/${userB}`)));
});

test('nega notificação de remoção sem apagar o vínculo', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(
    setDoc(doc(db, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`), {
      type: 'baby-access-removed',
      babyId: sharedBaby,
      babyName: 'Bebê compartilhado',
      createdAt: serverTimestamp(),
      readAt: null,
    }),
  );
});

test('nega responsável criando notificação de remoção', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertFails(
    setDoc(doc(db, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`), {
      type: 'baby-access-removed',
      babyId: sharedBaby,
      babyName: 'Bebê compartilhado',
      createdAt: serverTimestamp(),
      readAt: null,
    }),
  );
});

test('permite responsável confirmar remoção e limpar o próprio perfil', async () => {
  const caregiverDb = testEnv.authenticatedContext(userB).firestore();

  await assertSucceeds(
    setDoc(
      doc(caregiverDb, `users/${userB}`),
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

  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  const removalBatch = createAccessRemovalBatch(ownerDb);

  await assertSucceeds(removalBatch.commit());

  const acknowledgeBatch = writeBatch(caregiverDb);

  acknowledgeBatch.set(
    doc(caregiverDb, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`),
    {
      readAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  acknowledgeBatch.set(
    doc(caregiverDb, `users/${userB}`),
    {
      babyName: '',
      babyBirthDate: '',
      activeBabyId: deleteField(),
      babyMigrationVersion: deleteField(),
      babyMigratedAt: deleteField(),
    },
    {
      merge: true,
    },
  );

  await assertSucceeds(acknowledgeBatch.commit());

  const profile = await assertSucceeds(getDoc(doc(caregiverDb, `users/${userB}`)));

  assert.equal(profile.data().caregiverName, 'Conta B');
  assert.equal(profile.data().babyName, '');
  assert.equal(profile.data().babyBirthDate, '');
  assert.equal(profile.data().consentGiven, true);
  assert.equal(profile.data().activeBabyId, undefined);

  const notification = await assertSucceeds(
    getDoc(doc(caregiverDb, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`)),
  );

  assert.notEqual(notification.data().readAt, null);
});

test('permite responsável selecionar outro bebê após perder acesso ao ativo', async () => {
  const fallbackBaby = 'baby-fallback';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, `babies/${fallbackBaby}`), {
      name: 'Bebê fallback',
      birthDate: '2026-02-01',
      createdByUid: userB,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `babies/${fallbackBaby}/members/${userB}`), {
      role: 'owner',
      joinedAt: '2026-02-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `users/${userB}/babies/${fallbackBaby}`), {
      role: 'owner',
      joinedAt: '2026-02-01T00:00:00.000Z',
    });

    await setDoc(
      doc(db, `users/${userB}`),
      {
        activeBabyId: sharedBaby,
      },
      {
        merge: true,
      },
    );
  });

  const ownerDb = testEnv.authenticatedContext(userA).firestore();
  const removalBatch = createAccessRemovalBatch(ownerDb);

  await assertSucceeds(removalBatch.commit());

  const caregiverDb = testEnv.authenticatedContext(userB).firestore();
  const acknowledgeBatch = writeBatch(caregiverDb);

  acknowledgeBatch.set(
    doc(caregiverDb, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`),
    {
      readAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  acknowledgeBatch.set(
    doc(caregiverDb, `users/${userB}`),
    {
      activeBabyId: fallbackBaby,
    },
    {
      merge: true,
    },
  );

  await assertSucceeds(acknowledgeBatch.commit());

  const profile = await assertSucceeds(getDoc(doc(caregiverDb, `users/${userB}`)));

  assert.equal(profile.data().activeBabyId, fallbackBaby);
  await assertSucceeds(getDoc(doc(caregiverDb, `babies/${fallbackBaby}`)));
});

test('nega responsável acrescentando campos à notificação de remoção', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  const removalBatch = createAccessRemovalBatch(ownerDb);

  await assertSucceeds(removalBatch.commit());

  const caregiverDb = testEnv.authenticatedContext(userB).firestore();

  await assertFails(
    setDoc(
      doc(caregiverDb, `users/${userB}/notifications/baby-access-removed-${sharedBaby}`),
      {
        readAt: serverTimestamp(),
        extra: 'campo não permitido',
      },
      {
        merge: true,
      },
    ),
  );
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

  batch.set(doc(db, `users/${userC}/babies/${babyId}`), {
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

test('nega convite para conta legada antes de migrar seus dados', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, `users/${userC}`), {
      babyName: 'Bebê legado',
      babyBirthDate: '2026-02-01',
    }, { merge: true });

    await setDoc(doc(db, `users/${userC}/diapers/diaper-antiga`), {
      id: 'diaper-antiga',
      type: 'wet',
      recordedAt: 1234,
    });
  });

  await createPendingInvite();
  const db = testEnv.authenticatedContext(userC).firestore();

  await assertFails(createAcceptanceBatch(db).commit());

  const profile = await assertSucceeds(getDoc(doc(db, `users/${userC}`)));
  assert.equal(profile.data().babyName, 'Bebê legado');
  assert.equal(profile.data().activeBabyId, undefined);
  const diaper = await assertSucceeds(getDoc(doc(db, `users/${userC}/diapers/diaper-antiga`)));
  assert.equal(diaper.exists(), true);
});

test('nega convite quando houve migração interrompida', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${userC}`), {
      activeBabyId: 'baby-interrompido',
    }, { merge: true });
  });

  await createPendingInvite();
  const db = testEnv.authenticatedContext(userC).firestore();
  await assertFails(createAcceptanceBatch(db).commit());
});

test('não permite forjar migração no mesmo lote do convite', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${userC}`), {
      babyName: 'Bebê legado',
      babyBirthDate: '2026-02-01',
    }, { merge: true });
  });

  await createPendingInvite();
  const db = testEnv.authenticatedContext(userC).firestore();
  const batch = createAcceptanceBatch(db, inviteToken, {
    babyMigrationVersion: 1,
    babyMigratedAt: new Date().toISOString(),
  });

  await assertFails(batch.commit());
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
   * O proprietário remove userC
   * e cria a notificação no mesmo lote.
   */
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  const removalBatch = createAccessRemovalBatch(ownerDb, userC);

  await assertSucceeds(removalBatch.commit());

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

    const notification = await getDoc(
      doc(adminDb, `users/${userC}/notifications/baby-access-removed-${sharedBaby}`),
    );

    assert.equal(notification.exists(), true);
    assert.equal(notification.data().type, 'baby-access-removed');
    assert.equal(notification.data().babyId, sharedBaby);
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

test('nega exclusão completa do bebê no MVP', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(deleteDoc(doc(db, `babies/${sharedBaby}`)));
});

test('nega responsável removendo o próprio vínculo', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertFails(deleteDoc(doc(db, `babies/${sharedBaby}/members/${userB}`)));
});

test('permite convite adicionar outro bebê e torná-lo ativo', async () => {
  const currentBaby = 'baby-user-c';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, `babies/${currentBaby}`), {
      name: 'Bebê atual',
      birthDate: '2026-01-01',
      createdByUid: userC,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(doc(db, `babies/${currentBaby}/members/${userC}`), {
      role: 'owner',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });

    await setDoc(
      doc(db, `users/${userC}`),
      {
        activeBabyId: currentBaby,
        babyMigrationVersion: 1,
        babyMigratedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        merge: true,
      },
    );
  });

  await createPendingInvite();

  const db = testEnv.authenticatedContext(userC).firestore();
  const batch = createAcceptanceBatch(db);

  await assertSucceeds(batch.commit());

  const profile = await assertSucceeds(getDoc(doc(db, `users/${userC}`)));
  assert.equal(profile.data().activeBabyId, sharedBaby);

  const reference = await assertSucceeds(
    getDoc(doc(db, `users/${userC}/babies/${sharedBaby}`)),
  );
  assert.equal(reference.exists(), true);
});

test('permite responsável atualizar apenas o próprio nome', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertSucceeds(
    setDoc(
      doc(db, `babies/${sharedBaby}/members/${userB}`),
      {
        caregiverName: 'Novo nome',
      },
      {
        merge: true,
      },
    ),
  );
});

test('nega responsável alterando o próprio papel', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertFails(
    setDoc(
      doc(db, `babies/${sharedBaby}/members/${userB}`),
      {
        role: 'owner',
      },
      {
        merge: true,
      },
    ),
  );
});

test('aceita mamadas válidas com períodos e registros legados sem divisão', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertSucceeds(setDoc(doc(db, `babies/${sharedBaby}/feedings/feeding-periods`), {
    id: 'feeding-periods',
    startedAt: 1000,
    endedAt: 1600,
    side: 'right',
    periods: [
      { startedAt: 1000, endedAt: 1250, side: 'left' },
      { startedAt: 1250, endedAt: 1600, side: 'right' },
    ],
  }));

  await assertSucceeds(setDoc(doc(db, `babies/${sharedBaby}/feedings/feeding-legacy`), {
    id: 'feeding-legacy',
    startedAt: 1000,
    endedAt: 1600,
    side: 'right',
    periods: null,
  }));
});

test('valida todas as posições até o limite de 24 períodos', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();
  const periods = Array.from({ length: 24 }, (_, index) => ({
    startedAt: 1000 + index * 100,
    endedAt: 1100 + index * 100,
    side: index % 2 ? 'right' : 'left',
  }));

  await assertSucceeds(setDoc(doc(db, `babies/${sharedBaby}/feedings/feeding-24`), {
    id: 'feeding-24',
    startedAt: 1000,
    endedAt: 3400,
    side: 'right',
    periods,
  }));

  const invalid = periods.map((period) => ({ ...period }));
  invalid[22].endedAt = 999;

  await assertFails(setDoc(doc(db, `babies/${sharedBaby}/feedings/feeding-invalid-24`), {
    id: 'feeding-invalid-24',
    startedAt: 1000,
    endedAt: 3400,
    side: 'right',
    periods: invalid,
  }));
});

test('nega estrutura inválida de períodos em qualquer mamada', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();
  const valid = [
    { startedAt: 1000, endedAt: 1200, side: 'left' },
    { startedAt: 1200, endedAt: 1600, side: 'right' },
  ];
  const invalidCases = [
    [],
    'não é uma lista',
    [null],
    [{ startedAt: '1000', endedAt: 1600, side: 'right' }],
    [{ startedAt: -1, endedAt: 1600, side: 'right' }],
    [{ startedAt: 1000, endedAt: 999, side: 'right' }],
    [{ startedAt: 1000, endedAt: 1600, side: 'inválido' }],
    [{ startedAt: 1000, endedAt: 1600 }],
    [{ startedAt: 1000, endedAt: 1600, side: 'right', secret: true }],
    [{ startedAt: 999, endedAt: 1600, side: 'right' }],
    [
      { startedAt: 1000, endedAt: null, side: 'left' },
      { startedAt: 1200, endedAt: 1600, side: 'right' },
    ],
    [
      { startedAt: 1000, endedAt: 1200, side: 'left' },
      { startedAt: 1300, endedAt: 1600, side: 'right' },
    ],
    [valid[0], { ...valid[1], endedAt: 1550 }],
    [valid[0], { ...valid[1], side: 'left' }],
    Array.from({ length: 25 }, (_, index) => ({
      startedAt: 1000 + index * 20,
      endedAt: 1020 + index * 20,
      side: 'right',
    })),
  ];

  for (let index = 0; index < invalidCases.length; index++) {
    const id = `feeding-invalid-${index}`;

    await assertFails(setDoc(doc(db, `babies/${sharedBaby}/feedings/${id}`), {
      id,
      startedAt: 1000,
      endedAt: 1600,
      side: 'right',
      periods: invalidCases[index],
    }));
  }
});

test('nega 25 períodos mesmo quando todos são estruturalmente válidos', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();
  const periods = Array.from({ length: 25 }, (_, index) => ({
    startedAt: 1000 + index * 100,
    endedAt: 1100 + index * 100,
    side: 'right',
  }));

  await assertFails(setDoc(doc(db, `babies/${sharedBaby}/feedings/feeding-25`), {
    id: 'feeding-25',
    startedAt: 1000,
    endedAt: 3500,
    side: 'right',
    periods,
  }));
});

test('a validação também protege a coleção legada de cada usuário', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(setDoc(doc(db, `users/${userA}/feedings/invalid-legacy`), {
    id: 'invalid-legacy',
    startedAt: 1000,
    endedAt: 1600,
    side: 'right',
    periods: [],
  }));
});

test('nega mamada aberta sem lock de atividade', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(
    setDoc(doc(db, `babies/${sharedBaby}/feedings/feeding-open`), {
      id: 'feeding-open',
      startedAt: 1000,
      endedAt: null,
      side: 'left',
      periods: null,
    }),
  );
});

test('permite iniciar mamada com lock no mesmo lote', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();
  const batch = writeBatch(db);

  batch.set(doc(db, `babies/${sharedBaby}/feedings/feeding-open`), {
    id: 'feeding-open',
    startedAt: 1000,
    endedAt: null,
    side: 'left',
    periods: null,
  });

  batch.set(doc(db, `babies/${sharedBaby}/activeActivities/feeding`), {
    recordId: 'feeding-open',
  });

  await assertSucceeds(batch.commit());
});

test('nega segunda mamada em andamento para o mesmo bebê', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  const firstBatch = writeBatch(ownerDb);

  firstBatch.set(doc(ownerDb, `babies/${sharedBaby}/feedings/feeding-one`), {
    id: 'feeding-one',
    startedAt: 1000,
    endedAt: null,
    side: 'left',
    periods: null,
  });

  firstBatch.set(doc(ownerDb, `babies/${sharedBaby}/activeActivities/feeding`), {
    recordId: 'feeding-one',
  });

  await assertSucceeds(firstBatch.commit());

  const caregiverDb = testEnv.authenticatedContext(userB).firestore();
  const secondBatch = writeBatch(caregiverDb);

  secondBatch.set(doc(caregiverDb, `babies/${sharedBaby}/feedings/feeding-two`), {
    id: 'feeding-two',
    startedAt: 2000,
    endedAt: null,
    side: 'right',
    periods: null,
  });

  secondBatch.set(doc(caregiverDb, `babies/${sharedBaby}/activeActivities/feeding`), {
    recordId: 'feeding-two',
  });

  await assertFails(secondBatch.commit());
});

test('permite encerrar mamada e remover lock no mesmo lote', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  const startBatch = writeBatch(db);

  startBatch.set(doc(db, `babies/${sharedBaby}/feedings/feeding-open`), {
    id: 'feeding-open',
    startedAt: 1000,
    endedAt: null,
    side: 'left',
    periods: null,
  });

  startBatch.set(doc(db, `babies/${sharedBaby}/activeActivities/feeding`), {
    recordId: 'feeding-open',
  });

  await assertSucceeds(startBatch.commit());

  const finishBatch = writeBatch(db);

  finishBatch.set(
    doc(db, `babies/${sharedBaby}/feedings/feeding-open`),
    {
      endedAt: 2000,
    },
    {
      merge: true,
    },
  );

  finishBatch.delete(
    doc(db, `babies/${sharedBaby}/activeActivities/feeding`),
  );

  await assertSucceeds(finishBatch.commit());
});

test('nega remover lock enquanto mamada continua aberta', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  const batch = writeBatch(db);

  batch.set(doc(db, `babies/${sharedBaby}/feedings/feeding-open`), {
    id: 'feeding-open',
    startedAt: 1000,
    endedAt: null,
    side: 'left',
    periods: null,
  });

  batch.set(doc(db, `babies/${sharedBaby}/activeActivities/feeding`), {
    recordId: 'feeding-open',
  });

  await assertSucceeds(batch.commit());

  await assertFails(
    deleteDoc(
      doc(db, `babies/${sharedBaby}/activeActivities/feeding`),
    ),
  );
});

test('nega sono aberto sem lock de atividade', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();

  await assertFails(
    setDoc(doc(db, `babies/${sharedBaby}/sleeps/sleep-open`), {
      id: 'sleep-open',
      startedAt: 1000,
      endedAt: null,
    }),
  );
});

test('permite iniciar sono com lock no mesmo lote', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();
  const batch = writeBatch(db);

  batch.set(doc(db, `babies/${sharedBaby}/sleeps/sleep-open`), {
    id: 'sleep-open',
    startedAt: 1000,
    endedAt: null,
  });

  batch.set(doc(db, `babies/${sharedBaby}/activeActivities/sleep`), {
    recordId: 'sleep-open',
  });

  await assertSucceeds(batch.commit());
});

test('nega segundo sono em andamento para o mesmo bebê', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  const firstBatch = writeBatch(ownerDb);

  firstBatch.set(doc(ownerDb, `babies/${sharedBaby}/sleeps/sleep-one`), {
    id: 'sleep-one',
    startedAt: 1000,
    endedAt: null,
  });

  firstBatch.set(doc(ownerDb, `babies/${sharedBaby}/activeActivities/sleep`), {
    recordId: 'sleep-one',
  });

  await assertSucceeds(firstBatch.commit());

  const caregiverDb = testEnv.authenticatedContext(userB).firestore();
  const secondBatch = writeBatch(caregiverDb);

  secondBatch.set(doc(caregiverDb, `babies/${sharedBaby}/sleeps/sleep-two`), {
    id: 'sleep-two',
    startedAt: 2000,
    endedAt: null,
  });

  secondBatch.set(doc(caregiverDb, `babies/${sharedBaby}/activeActivities/sleep`), {
    recordId: 'sleep-two',
  });

  await assertFails(secondBatch.commit());
});


test('permite autoria de cuidadores autorizados e preserva registros sem autor', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertSucceeds(getDoc(doc(db, `babies/${sharedBaby}/diapers/shared-diaper`)));

  await assertSucceeds(
    setDoc(doc(db, `babies/${sharedBaby}/diapers/diaper-authored`), {
      id: 'diaper-authored',
      type: 'wet',
      recordedAt: 2000,
      createdByUid: userB,
    }),
  );

  await assertSucceeds(
    setDoc(doc(db, `babies/${sharedBaby}/diapers/diaper-authored`), {
      type: 'dirty',
    }, { merge: true }),
  );

  const saved = await getDoc(doc(db, `babies/${sharedBaby}/diapers/diaper-authored`));

  assert.equal(saved.data().createdByUid, userB);
  assert.equal(saved.data().type, 'dirty');
});

test('nega autoria falsa e alteração posterior do autor', async () => {
  const db = testEnv.authenticatedContext(userB).firestore();

  await assertFails(
    setDoc(doc(db, `babies/${sharedBaby}/diapers/diaper-forged`), {
      id: 'diaper-forged',
      type: 'wet',
      recordedAt: 2000,
      createdByUid: userA,
    }),
  );

  const path = `babies/${sharedBaby}/diapers/diaper-authored`;

  await assertSucceeds(
    setDoc(doc(db, path), {
      id: 'diaper-authored',
      type: 'wet',
      recordedAt: 2000,
      createdByUid: userB,
    }),
  );

  const ownerDb = testEnv.authenticatedContext(userA).firestore();

  await assertFails(
    setDoc(doc(ownerDb, path), {
      createdByUid: userA,
    }, { merge: true }),
  );

  await assertFails(
    setDoc(doc(ownerDb, path), {
      createdByUid: deleteField(),
    }, { merge: true }),
  );

  const outsideDb = testEnv.authenticatedContext(userC).firestore();

  await assertFails(getDoc(doc(outsideDb, path)));
});

test('permite encerrar sono em outro aparelho identificando quem finalizou', async () => {
  const ownerDb = testEnv.authenticatedContext(userA).firestore();
  const caregiverDb = testEnv.authenticatedContext(userB).firestore();
  const path = `babies/${sharedBaby}/sleeps/sleep-authored`;
  const lockPath = `babies/${sharedBaby}/activeActivities/sleep`;

  const start = writeBatch(ownerDb);
  start.set(doc(ownerDb, path), {
    id: 'sleep-authored',
    startedAt: 1000,
    endedAt: null,
    createdByUid: userA,
  });
  start.set(doc(ownerDb, lockPath), { recordId: 'sleep-authored' });

  await assertSucceeds(start.commit());

  const forgedEnd = writeBatch(caregiverDb);
  forgedEnd.set(doc(caregiverDb, path), {
    endedAt: 3000,
    finishedByUid: userA,
  }, { merge: true });
  forgedEnd.delete(doc(caregiverDb, lockPath));

  await assertFails(forgedEnd.commit());

  const validEnd = writeBatch(caregiverDb);
  validEnd.set(doc(caregiverDb, path), {
    endedAt: 3000,
    finishedByUid: userB,
  }, { merge: true });
  validEnd.delete(doc(caregiverDb, lockPath));

  await assertSucceeds(validEnd.commit());

  const saved = await getDoc(doc(caregiverDb, path));

  assert.equal(saved.data().createdByUid, userA);
  assert.equal(saved.data().finishedByUid, userB);
});

test('permite proprietário completar o próprio nome sem modificar o papel', async () => {
  const db = testEnv.authenticatedContext(userA).firestore();
  const path = `babies/${sharedBaby}/members/${userA}`;

  await assertSucceeds(
    setDoc(doc(db, path), { caregiverName: 'Marcelo' }, { merge: true }),
  );

  const member = await getDoc(doc(db, path));

  assert.equal(member.data().role, 'owner');
  assert.equal(member.data().caregiverName, 'Marcelo');

  await assertFails(
    setDoc(doc(db, path), { role: 'caregiver' }, { merge: true }),
  );
});

