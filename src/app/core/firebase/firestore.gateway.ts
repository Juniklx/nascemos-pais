import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { FIREBASE_FIRESTORE } from './firebase-firestore';

export interface FirestoreBatchEntry {
  path: string;
  data: DocumentData;
}

export interface FirestoreBatchSetOperation {
  type: 'set';
  path: string;
  data: DocumentData;
  merge?: boolean;
}

export interface FirestoreBatchDeleteOperation {
  type: 'delete';
  path: string;
}

export type FirestoreBatchOperation = FirestoreBatchSetOperation | FirestoreBatchDeleteOperation;

export interface FirestoreTransactionContext {
  get(path: string): Promise<DocumentData | null>;
  set(path: string, data: DocumentData, merge?: boolean): void;
  delete(path: string): void;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreGateway {
  private readonly firestore = inject(FIREBASE_FIRESTORE);

  createId(collectionPath: string): string {
    return doc(collection(this.firestore, collectionPath)).id;
  }

  async get(path: string): Promise<DocumentData | null> {
    const snapshot = await getDoc(doc(this.firestore, path));

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  async list(path: string): Promise<DocumentData[]> {
    const snapshot = await getDocs(collection(this.firestore, path));

    return snapshot.docs.map((item) => ({
      ...item.data(),
      id: item.id,
    }));
  }

  set(path: string, data: DocumentData, merge = true): Promise<void> {
    return setDoc(doc(this.firestore, path), data, { merge });
  }

  delete(path: string): Promise<void> {
    return deleteDoc(doc(this.firestore, path));
  }

  async batchSet(entries: readonly FirestoreBatchEntry[]): Promise<void> {
    if (entries.length > 500) {
      throw new Error('O lote do Firestore excede 500 operações.');
    }

    const batch = writeBatch(this.firestore);

    for (const entry of entries) {
      batch.set(doc(this.firestore, entry.path), entry.data, {
        merge: true,
      });
    }

    await batch.commit();
  }

  async batchWrite(operations: readonly FirestoreBatchOperation[]): Promise<void> {
    if (operations.length > 500) {
      throw new Error('O lote do Firestore excede 500 operações.');
    }

    const batch = writeBatch(this.firestore);

    for (const operation of operations) {
      if (operation.type === 'delete') {
        batch.delete(doc(this.firestore, operation.path));
        continue;
      }

      batch.set(doc(this.firestore, operation.path), operation.data, {
        merge: operation.merge ?? true,
      });
    }

    await batch.commit();
  }

  async transaction<T>(work: (context: FirestoreTransactionContext) => Promise<T>): Promise<T> {
    return runTransaction(this.firestore, async (transaction) => {
      const context: FirestoreTransactionContext = {
        get: async (path) => {
          const snapshot = await transaction.get(doc(this.firestore, path));

          return snapshot.exists() ? snapshot.data() : null;
        },
        set: (path, data, merge = true) => {
          transaction.set(doc(this.firestore, path), data, { merge });
        },
        delete: (path) => {
          transaction.delete(doc(this.firestore, path));
        },
      };

      return work(context);
    });
  }
}
