import {
  Injectable,
  inject,
} from '@angular/core';

import {
  DocumentData,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  FIREBASE_FIRESTORE,
} from './firebase-firestore';

export interface FirestoreBatchEntry {
  path: string;
  data: DocumentData;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreGateway {
  private readonly firestore =
    inject(FIREBASE_FIRESTORE);

  createId(
    collectionPath: string,
  ): string {
    return doc(
      collection(
        this.firestore,
        collectionPath,
      ),
    ).id;
  }

  async get(
    path: string,
  ): Promise<DocumentData | null> {
    const snapshot =
      await getDoc(
        doc(this.firestore, path),
      );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  async list(
    path: string,
  ): Promise<DocumentData[]> {
    const snapshot =
      await getDocs(
        collection(
          this.firestore,
          path,
        ),
      );

    return snapshot.docs.map(
      (item) => ({
        ...item.data(),
        id: item.id,
      }),
    );
  }

  set(
    path: string,
    data: DocumentData,
    merge = true,
  ): Promise<void> {
    return setDoc(
      doc(this.firestore, path),
      data,
      { merge },
    );
  }

  delete(
    path: string,
  ): Promise<void> {
    return deleteDoc(
      doc(this.firestore, path),
    );
  }

  async batchSet(
    entries:
      readonly FirestoreBatchEntry[],
  ): Promise<void> {
    if (entries.length > 500) {
      throw new Error(
        'O lote do Firestore excede 500 operações.',
      );
    }

    const batch =
      writeBatch(this.firestore);

    for (const entry of entries) {
      batch.set(
        doc(
          this.firestore,
          entry.path,
        ),
        entry.data,
        {
          merge: true,
        },
      );
    }

    await batch.commit();
  }
}