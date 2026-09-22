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
    const uid =
      this.requireUid();

    const data =
      await this.firestore.get(
        this.userPath(uid),
      );

    this.assertSameUser(uid);

    return data as T | null;
  }

  async saveProfile(
    data: DocumentData,
  ): Promise<void> {
    const uid =
      this.requireUid();

    await this.firestore.set(
      this.userPath(uid),
      data,
      true,
    );

    this.assertSameUser(uid);
  }

  async listRecords<
    T extends DocumentData,
  >(
    collectionName:
      UserRecordCollection,
  ): Promise<T[]> {
    const uid =
      this.requireUid();

    const records =
      await this.firestore.list(
        this.collectionPath(
          uid,
          collectionName,
        ),
      );

    this.assertSameUser(uid);

    return records as T[];
  }

  async saveRecord<
    T extends DocumentData & {
      id: string;
    },
  >(
    collectionName:
      UserRecordCollection,
    record: T,
  ): Promise<void> {
    const uid =
      this.requireUid();

    this.validateId(
      record.id,
    );

    await this.firestore.set(
      this.recordPath(
        uid,
        collectionName,
        record.id,
      ),
      record,
      true,
    );

    this.assertSameUser(uid);
  }

  async deleteRecord(
    collectionName:
      UserRecordCollection,
    id: string,
  ): Promise<void> {
    const uid =
      this.requireUid();

    this.validateId(id);

    await this.firestore.delete(
      this.recordPath(
        uid,
        collectionName,
        id,
      ),
    );

    this.assertSameUser(uid);
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
    /*
     * O UID é capturado uma única vez.
     * Assim, mesmo se a autenticação mudar
     * durante uma operação longa, nenhum
     * lote poderá ser redirecionado para
     * outra conta.
     */
    const uid =
      this.requireUid();

    const chunkSize =
      400;

    for (
      let index = 0;
      index < records.length;
      index += chunkSize
    ) {
      /*
       * Verifica a sessão antes de iniciar
       * cada novo lote.
       */
      this.assertSameUser(
        uid,
      );

      const chunk =
        records.slice(
          index,
          index +
            chunkSize,
        );

      const entries =
        chunk.map(
          (record) => {
            this.validateId(
              record.id,
            );

            return {
              path:
                this.recordPath(
                  uid,
                  collectionName,
                  record.id,
                ),

              data:
                record,
            };
          },
        );

      await this.firestore
        .batchSet(
          entries,
        );

      /*
       * Também verificamos depois da
       * confirmação do Firestore.
       */
      this.assertSameUser(
        uid,
      );
    }
  }

  private userPath(
    uid: string,
  ): string {
    return (
      `users/${uid}`
    );
  }

  private collectionPath(
    uid: string,
    collectionName:
      UserRecordCollection,
  ): string {
    return (
      `${this.userPath(
        uid,
      )}/${collectionName}`
    );
  }

  private recordPath(
    uid: string,
    collectionName:
      UserRecordCollection,
    id: string,
  ): string {
    return (
      `${this.collectionPath(
        uid,
        collectionName,
      )}/${id}`
    );
  }

  private requireUid():
    string {
    const uid =
      this.auth.user()?.uid;

    if (!uid) {
      throw new Error(
        'Usuário não autenticado.',
      );
    }

    return uid;
  }

  private assertSameUser(
    uid: string,
  ): void {
    if (
      this.auth
        .user()?.uid !==
      uid
    ) {
      throw new Error(
        'A sessão mudou durante a operação.',
      );
    }
  }

  private validateId(
    id: string,
  ): void {
    if (
      id.trim().length ===
        0 ||
      id.includes('/')
    ) {
      throw new Error(
        'ID de registro inválido.',
      );
    }
  }
}