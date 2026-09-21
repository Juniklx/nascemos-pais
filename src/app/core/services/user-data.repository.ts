import {
  Injectable,
  inject,
} from '@angular/core';

import {
  DocumentData,
} from 'firebase/firestore';

import {
  FirestoreGateway,
} from '../firebase/firestore.gateway';

import {
  AuthService,
} from './auth';

export type UserRecordCollection =
  | 'feedings'
  | 'sleeps'
  | 'diapers';

@Injectable({
  providedIn: 'root',
})
export class UserDataRepository {
  private readonly auth =
    inject(AuthService);

  private readonly firestore =
    inject(FirestoreGateway);

  async readProfile<
    T extends DocumentData,
  >(): Promise<T | null> {
    const data =
      await this.firestore.get(
        this.userPath(),
      );

    return data as T | null;
  }

  saveProfile(
    data: DocumentData,
  ): Promise<void> {
    return this.firestore.set(
      this.userPath(),
      data,
      true,
    );
  }

  async listRecords<
    T extends DocumentData,
  >(
    collectionName:
      UserRecordCollection,
  ): Promise<T[]> {
    const records =
      await this.firestore.list(
        this.collectionPath(
          collectionName,
        ),
      );

    return records as T[];
  }

  saveRecord<
    T extends DocumentData & {
      id: string;
    },
  >(
    collectionName:
      UserRecordCollection,
    record: T,
  ): Promise<void> {
    this.validateId(record.id);

    return this.firestore.set(
      this.recordPath(
        collectionName,
        record.id,
      ),
      record,
      true,
    );
  }

  deleteRecord(
    collectionName:
      UserRecordCollection,
    id: string,
  ): Promise<void> {
    this.validateId(id);

    return this.firestore.delete(
      this.recordPath(
        collectionName,
        id,
      ),
    );
  }

  async saveRecords<
    T extends DocumentData & {
      id: string;
    },
  >(
    collectionName:
      UserRecordCollection,
    records: readonly T[],
  ): Promise<void> {
    const chunkSize = 400;

    for (
      let index = 0;
      index < records.length;
      index += chunkSize
    ) {
      const chunk =
        records.slice(
          index,
          index + chunkSize,
        );

      const entries =
        chunk.map((record) => {
          this.validateId(
            record.id,
          );

          return {
            path:
              this.recordPath(
                collectionName,
                record.id,
              ),

            data: record,
          };
        });

      await this.firestore.batchSet(
        entries,
      );
    }
  }

  private userPath(): string {
    return `users/${this.requireUid()}`;
  }

  private collectionPath(
    collectionName:
      UserRecordCollection,
  ): string {
    return (
      `${this.userPath()}/` +
      collectionName
    );
  }

  private recordPath(
    collectionName:
      UserRecordCollection,
    id: string,
  ): string {
    return (
      `${this.collectionPath(
        collectionName,
      )}/${id}`
    );
  }

  private requireUid(): string {
    const uid =
      this.auth.user()?.uid;

    if (!uid) {
      throw new Error(
        'Usuário não autenticado.',
      );
    }

    return uid;
  }

  private validateId(
    id: string,
  ): void {
    if (
      id.trim().length === 0 ||
      id.includes('/')
    ) {
      throw new Error(
        'ID de registro inválido.',
      );
    }
  }
}