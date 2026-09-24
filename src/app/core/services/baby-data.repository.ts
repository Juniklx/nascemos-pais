import { Injectable, inject } from '@angular/core';
import { DocumentData, serverTimestamp } from 'firebase/firestore';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { Baby, BabyMember, BabyMemberRole, CreateBabyInput, LinkedBaby } from '../models/baby';
import { AuthService } from './auth';

export type BabyRecordCollection = 'feedings' | 'sleeps' | 'diapers';

interface UpdateBabyInput {
  readonly name: string;
  readonly birthDate: string;
}

interface ClaimedBabyResult {
  readonly babyId: string;
  readonly baby: Baby | null;
}

@Injectable({
  providedIn: 'root',
})
export class BabyDataRepository {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreGateway);

  async updateOwnCaregiverName(babyId: string, caregiverName: string): Promise<void> {
    const uid = this.requireUid();
    const name = caregiverName.trim();

    this.validateId(babyId);

    if (name.length === 0 || name.length > 80) {
      throw new Error('Nome do responsável inválido.');
    }

    await this.firestore.batchSet([
      {
        path: this.memberPath(babyId, uid),
        data: {
          caregiverName: name,
        },
      },
      {
        path: this.userPath(uid),
        data: {
          caregiverName: name,
        },
      },
    ]);

    this.assertSameUser(uid);
  }

  async createOwnedBaby(input: CreateBabyInput): Promise<Baby> {
    const uid = this.requireUid();
    const name = input.name.trim();

    if (name.length === 0 || name.length > 80 || !this.isBirthDate(input.birthDate)) {
      throw new Error('Dados do bebê inválidos.');
    }

    const babyId = this.firestore.createId('babies');

    this.validateId(babyId);

    const now = new Date().toISOString();

    const baby: Baby = {
      id: babyId,
      name,
      birthDate: input.birthDate,
      createdByUid: uid,
      createdAt: now,
      updatedAt: now,
    };

    await this.firestore.batchSet([
      {
        path: this.babyPath(babyId),
        data: this.toBabyDocument(baby),
      },
      {
        path: this.memberPath(babyId, uid),
        data: {
          role: 'owner',
          joinedAt: now,
        },
      },
      {
        path: this.userBabyPath(uid, babyId),
        data: {
          role: 'owner',
          joinedAt: now,
        },
      },
      {
        path: this.userPath(uid),
        data: {
          activeBabyId: babyId,
        },
      },
    ]);

    this.assertSameUser(uid);

    return baby;
  }

  async claimOwnedBaby(input: CreateBabyInput): Promise<Baby> {
    const uid = this.requireUid();
    const name = input.name.trim();

    if (name.length === 0 || name.length > 80 || !this.isBirthDate(input.birthDate)) {
      throw new Error('Dados do bebê inválidos.');
    }

    const result = await this.firestore.transaction<ClaimedBabyResult>(async (transaction) => {
      const profile = await transaction.get(this.userPath(uid));

      this.assertSameUser(uid);

      if (profile === null) {
        throw new Error('Perfil do usuário não encontrado.');
      }

      const currentBabyId = profile['activeBabyId'];

      if (currentBabyId !== undefined && currentBabyId !== null) {
        if (
          typeof currentBabyId !== 'string' ||
          currentBabyId.trim().length === 0 ||
          currentBabyId.includes('/')
        ) {
          throw new Error('A referência do bebê é inválida.');
        }

        return {
          babyId: currentBabyId,
          baby: null,
        };
      }

      const babyId = this.firestore.createId('babies');

      this.validateId(babyId);

      const now = new Date().toISOString();

      const baby: Baby = {
        id: babyId,
        name,
        birthDate: input.birthDate,
        createdByUid: uid,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(this.babyPath(babyId), this.toBabyDocument(baby), false);

      transaction.set(
        this.memberPath(babyId, uid),
        {
          role: 'owner',
          joinedAt: now,
        },
        false,
      );

      transaction.set(
        this.userBabyPath(uid, babyId),
        {
          role: 'owner',
          joinedAt: now,
        },
        false,
      );

      transaction.set(
        this.userPath(uid),
        {
          activeBabyId: babyId,
        },
        true,
      );

      return {
        babyId,
        baby,
      };
    });

    this.assertSameUser(uid);

    if (result.baby !== null) {
      return result.baby;
    }

    /*
     * Se a transação foi refeita porque outro
     * dispositivo concluiu a criação primeiro,
     * validamos que o bebê vencedor realmente
     * pertence a esta conta.
     */
    const baby = await this.readBaby(result.babyId);

    this.assertSameUser(uid);

    const membership = await this.readMembership(result.babyId);

    this.assertSameUser(uid);

    if (
      baby === null ||
      membership === null ||
      baby.createdByUid !== uid ||
      membership.role !== 'owner'
    ) {
      throw new Error('O bebê ativo não pertence a esta conta.');
    }

    await this.ensureBabyReference(result.babyId, membership);

    return baby;
  }

  async ensureBabyReference(babyId: string, membership?: BabyMember): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const currentMembership = membership ?? (await this.readMembership(babyId));

    this.assertSameUser(uid);

    if (currentMembership === null) {
      throw new Error('Vínculo com o bebê não encontrado.');
    }

    await this.firestore.set(
      this.userBabyPath(uid, babyId),
      {
        role: currentMembership.role,
        joinedAt: currentMembership.joinedAt,
      },
      true,
    );

    this.assertSameUser(uid);
  }

  async listLinkedBabies(): Promise<LinkedBaby[]> {
    const uid = this.requireUid();
    const references = await this.firestore.list(this.userBabiesPath(uid));

    this.assertSameUser(uid);

    const linked: LinkedBaby[] = [];

    for (const reference of references) {
      const babyId = reference['id'];

      if (typeof babyId !== 'string') {
        continue;
      }

      try {
        this.validateId(babyId);

        const [baby, membership] = await Promise.all([
          this.readBaby(babyId),
          this.readMembership(babyId),
        ]);

        this.assertSameUser(uid);

        if (baby !== null && membership !== null) {
          linked.push({
            baby,
            membership,
          });
        }
      } catch {
        this.assertSameUser(uid);
      }
    }

    return linked.sort((a, b) => a.baby.name.localeCompare(b.baby.name, 'pt-BR'));
  }

  async setActiveBaby(babyId: string): Promise<LinkedBaby> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const [baby, membership] = await Promise.all([
      this.readBaby(babyId),
      this.readMembership(babyId),
    ]);

    this.assertSameUser(uid);

    if (baby === null || membership === null) {
      throw new Error('Você não possui acesso a este bebê.');
    }

    await this.ensureBabyReference(babyId, membership);

    await this.firestore.set(
      this.userPath(uid),
      {
        activeBabyId: babyId,
      },
      true,
    );

    this.assertSameUser(uid);

    return {
      baby,
      membership,
    };
  }

  async readBaby(babyId: string): Promise<Baby | null> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const data = await this.firestore.get(this.babyPath(babyId));

    this.assertSameUser(uid);

    if (data === null) {
      return null;
    }

    return this.parseBaby(babyId, data);
  }

  async updateBaby(babyId: string, input: UpdateBabyInput): Promise<void> {
    const uid = this.requireUid();
    const name = input.name.trim();

    this.validateId(babyId);

    if (name.length === 0 || name.length > 80 || !this.isBirthDate(input.birthDate)) {
      throw new Error('Dados do bebê inválidos.');
    }

    await this.firestore.set(
      this.babyPath(babyId),
      {
        name,
        birthDate: input.birthDate,
        updatedAt: new Date().toISOString(),
      },
      true,
    );

    this.assertSameUser(uid);
  }

  async readMembership(babyId: string): Promise<BabyMember | null> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const data = await this.firestore.get(this.memberPath(babyId, uid));

    this.assertSameUser(uid);

    if (data === null) {
      return null;
    }

    return this.parseMember(uid, data);
  }

  async listMembers(babyId: string): Promise<BabyMember[]> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const members = await this.firestore.list(this.membersPath(babyId));

    this.assertSameUser(uid);

    return members.map((member) => {
      const memberUid = member['id'];

      if (typeof memberUid !== 'string') {
        throw new Error('Responsável inválido.');
      }

      return this.parseMember(memberUid, member);
    });
  }

  async removeMember(babyId: string, memberUid: string): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);
    this.validateId(memberUid);

    if (memberUid === uid) {
      throw new Error('Não é possível remover o próprio vínculo por esta ação.');
    }

    const baby = await this.readBaby(babyId);

    this.assertSameUser(uid);

    if (baby === null) {
      throw new Error('Bebê não encontrado.');
    }

    const notificationId = `baby-access-removed-${babyId}`;

    await this.firestore.batchWrite([
      {
        type: 'set',
        path: this.notificationPath(memberUid, notificationId),
        data: {
          type: 'baby-access-removed',
          babyId,
          babyName: baby.name,
          createdAt: serverTimestamp(),
          readAt: null,
        },
        merge: false,
      },
      {
        type: 'delete',
        path: this.memberPath(babyId, memberUid),
      },
      {
        type: 'delete',
        path: this.userBabyPath(memberUid, babyId),
      },
    ]);

    this.assertSameUser(uid);
  }

  async listRecords<T extends DocumentData>(
    babyId: string,
    collectionName: BabyRecordCollection,
  ): Promise<T[]> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const records = await this.firestore.list(this.collectionPath(babyId, collectionName));

    this.assertSameUser(uid);

    return records as T[];
  }

  async saveRecord<T extends DocumentData & { id: string }>(
    babyId: string,
    collectionName: BabyRecordCollection,
    record: T,
  ): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);
    this.validateId(record.id);

    const recordPath = this.recordPath(babyId, collectionName, record.id);
    const lockPath = this.activityLockPath(babyId, collectionName);

    if (lockPath === null) {
      await this.firestore.set(recordPath, record, true);

      this.assertSameUser(uid);

      return;
    }

    await this.firestore.transaction(async (transaction) => {
      const lock = await transaction.get(lockPath);

      this.assertSameUser(uid);

      const activeRecordId = this.parseActivityLock(lock);

      if (record['endedAt'] === null) {
        if (activeRecordId !== null && activeRecordId !== record.id) {
          throw new Error(
            collectionName === 'feedings'
              ? 'Já existe uma mamada em andamento.'
              : 'Já existe um sono em andamento.',
          );
        }

        transaction.set(recordPath, record, true);
        transaction.set(
          lockPath,
          {
            recordId: record.id,
          },
          false,
        );

        return;
      }

      transaction.set(recordPath, record, true);

      if (activeRecordId === record.id) {
        transaction.delete(lockPath);
      }
    });

    this.assertSameUser(uid);
  }

  async deleteRecord(
    babyId: string,
    collectionName: BabyRecordCollection,
    id: string,
  ): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);
    this.validateId(id);

    const recordPath = this.recordPath(babyId, collectionName, id);
    const lockPath = this.activityLockPath(babyId, collectionName);

    if (lockPath === null) {
      await this.firestore.delete(recordPath);

      this.assertSameUser(uid);

      return;
    }

    await this.firestore.transaction(async (transaction) => {
      const lock = await transaction.get(lockPath);

      this.assertSameUser(uid);

      transaction.delete(recordPath);

      if (this.parseActivityLock(lock) === id) {
        transaction.delete(lockPath);
      }
    });

    this.assertSameUser(uid);
  }

  async saveRecords<T extends DocumentData & { id: string }>(
    babyId: string,
    collectionName: BabyRecordCollection,
    records: readonly T[],
  ): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const timedCollection = this.activityLockPath(babyId, collectionName) !== null;

    const activeRecords = timedCollection
      ? records.filter((record) => record['endedAt'] === null)
      : [];

    const batchRecords = timedCollection
      ? records.filter((record) => record['endedAt'] !== null)
      : records;

    if (activeRecords.length > 1) {
      throw new Error('Os registros possuem atividades simultâneas inconsistentes.');
    }

    const chunkSize = 400;

    for (let index = 0; index < batchRecords.length; index += chunkSize) {
      this.assertSameUser(uid);

      const chunk = batchRecords.slice(index, index + chunkSize);

      const entries = chunk.map((record) => {
        this.validateId(record.id);

        return {
          path: this.recordPath(babyId, collectionName, record.id),
          data: record,
        };
      });

      await this.firestore.batchSet(entries);

      this.assertSameUser(uid);
    }

    for (const record of activeRecords) {
      await this.saveRecord(babyId, collectionName, record);

      this.assertSameUser(uid);
    }
  }

  private userPath(uid: string): string {
    return `users/${uid}`;
  }

  private userBabiesPath(uid: string): string {
    return `${this.userPath(uid)}/babies`;
  }

  private userBabyPath(uid: string, babyId: string): string {
    return `${this.userBabiesPath(uid)}/${babyId}`;
  }

  private notificationsPath(uid: string): string {
    return `${this.userPath(uid)}/notifications`;
  }

  private notificationPath(uid: string, notificationId: string): string {
    return `${this.notificationsPath(uid)}/${notificationId}`;
  }

  private babyPath(babyId: string): string {
    return `babies/${babyId}`;
  }

  private membersPath(babyId: string): string {
    return `${this.babyPath(babyId)}/members`;
  }

  private memberPath(babyId: string, uid: string): string {
    return `${this.membersPath(babyId)}/${uid}`;
  }

  private collectionPath(babyId: string, collectionName: BabyRecordCollection): string {
    return `${this.babyPath(babyId)}/${collectionName}`;
  }

  private recordPath(babyId: string, collectionName: BabyRecordCollection, id: string): string {
    return `${this.collectionPath(babyId, collectionName)}/${id}`;
  }

  private activityLockPath(babyId: string, collectionName: BabyRecordCollection): string | null {
    if (collectionName === 'feedings') {
      return `${this.babyPath(babyId)}/activeActivities/feeding`;
    }

    if (collectionName === 'sleeps') {
      return `${this.babyPath(babyId)}/activeActivities/sleep`;
    }

    return null;
  }

  private parseActivityLock(data: DocumentData | null): string | null {
    if (data === null) {
      return null;
    }

    const recordId = data['recordId'];

    if (typeof recordId !== 'string' || recordId.trim().length === 0 || recordId.includes('/')) {
      throw new Error('Controle de atividade inválido.');
    }

    return recordId;
  }

  private toBabyDocument(baby: Baby): DocumentData {
    return {
      name: baby.name,
      birthDate: baby.birthDate,
      createdByUid: baby.createdByUid,
      createdAt: baby.createdAt,
      updatedAt: baby.updatedAt,
    };
  }

  private parseBaby(id: string, data: DocumentData): Baby {
    const name = data['name'];
    const birthDate = data['birthDate'];
    const createdByUid = data['createdByUid'];
    const createdAt = data['createdAt'];
    const updatedAt = data['updatedAt'];

    if (
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      name.length > 80 ||
      typeof birthDate !== 'string' ||
      !this.isBirthDate(birthDate) ||
      typeof createdByUid !== 'string' ||
      createdByUid.length === 0 ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      throw new Error('Dados do bebê inválidos.');
    }

    return {
      id,
      name: name.trim(),
      birthDate,
      createdByUid,
      createdAt,
      updatedAt,
    };
  }

  private parseMember(uid: string, data: DocumentData): BabyMember {
    const role = data['role'];
    const joinedAt = data['joinedAt'];
    const inviteId = data['inviteId'];
    const caregiverName = data['caregiverName'];

    if (
      uid.trim().length === 0 ||
      !this.isMemberRole(role) ||
      typeof joinedAt !== 'string' ||
      (inviteId !== undefined &&
        (typeof inviteId !== 'string' ||
          inviteId.length < 32 ||
          inviteId.length > 128 ||
          inviteId.includes('/'))) ||
      (caregiverName !== undefined &&
        (typeof caregiverName !== 'string' ||
          caregiverName.trim().length === 0 ||
          caregiverName.trim().length > 80))
    ) {
      throw new Error('Responsável inválido.');
    }

    return {
      uid,
      role,
      joinedAt,
      ...(typeof inviteId === 'string' ? { inviteId } : {}),
      ...(typeof caregiverName === 'string'
        ? {
            caregiverName: caregiverName.trim(),
          }
        : {}),
    };
  }

  private isMemberRole(value: unknown): value is BabyMemberRole {
    return value === 'owner' || value === 'caregiver';
  }

  private isBirthDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00`);

    return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
  }

  private requireUid(): string {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      throw new Error('Usuário não autenticado.');
    }

    return uid;
  }

  private assertSameUser(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A sessão mudou durante a operação.');
    }
  }

  private validateId(id: string): void {
    if (id.trim().length === 0 || id.includes('/')) {
      throw new Error('ID inválido.');
    }
  }
}
