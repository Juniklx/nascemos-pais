import { Injectable, inject } from '@angular/core';
import { DocumentData } from 'firebase/firestore';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { Baby, BabyMember, BabyMemberRole, CreateBabyInput } from '../models/baby';
import { AuthService } from './auth';

export type BabyRecordCollection = 'feedings' | 'sleeps' | 'diapers';

@Injectable({
  providedIn: 'root',
})
export class BabyDataRepository {
  private readonly auth = inject(AuthService);

  private readonly firestore = inject(FirestoreGateway);

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
        path: this.userPath(uid),

        data: {
          activeBabyId: babyId,
        },
      },
    ]);

    this.assertSameUser(uid);

    return baby;
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

    await this.firestore.delete(this.memberPath(babyId, memberUid));

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

  async saveRecord<
    T extends DocumentData & {
      id: string;
    },
  >(babyId: string, collectionName: BabyRecordCollection, record: T): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);

    this.validateId(record.id);

    await this.firestore.set(this.recordPath(babyId, collectionName, record.id), record, true);

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

    await this.firestore.delete(this.recordPath(babyId, collectionName, id));

    this.assertSameUser(uid);
  }

  async saveRecords<
    T extends DocumentData & {
      id: string;
    },
  >(babyId: string, collectionName: BabyRecordCollection, records: readonly T[]): Promise<void> {
    const uid = this.requireUid();

    this.validateId(babyId);

    const chunkSize = 400;

    for (let index = 0; index < records.length; index += chunkSize) {
      this.assertSameUser(uid);

      const chunk = records.slice(index, index + chunkSize);

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
  }

  private userPath(uid: string): string {
    return `users/${uid}`;
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

      ...(typeof inviteId === 'string'
        ? {
            inviteId,
          }
        : {}),

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
