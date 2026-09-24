import { Injectable, inject } from '@angular/core';
import { FirestoreGateway } from '../firebase/firestore.gateway';
import { AuthService } from './auth';
import { BabyContextService } from './baby-context';

export interface DeletionBabyPreview {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'caregiver';
  readonly otherCaregivers: number;
}

export interface DeletionPreflight {
  readonly babies: readonly DeletionBabyPreview[];
  readonly requiresOwnerDecision: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccountDeletionPreflightService {
  private readonly auth = inject(AuthService);
  private readonly context = inject(BabyContextService);
  private readonly firestore = inject(FirestoreGateway);

  async preview(): Promise<DeletionPreflight> {
    await this.auth.waitUntilReady();
    const uid = this.auth.user()?.uid;

    if (!uid) {
      throw new Error('Entre na conta para verificar seus vínculos.');
    }

    await this.context.ensureLoaded();
    this.assertSession(uid);

    if (this.context.error()) {
      throw new Error('Os vínculos não foram carregados por completo. Tente novamente.');
    }

    const profile = await this.firestore.getFromServer(`users/${uid}`);
    this.assertSession(uid);

    if (!profile) {
      throw new Error('Não foi possível verificar seu perfil no servidor.');
    }

    const references = await this.firestore.listFromServer(`users/${uid}/babies`);
    this.assertSession(uid);

    const activeBabyId = this.context.activeBabyId();
    const knownIds = this.context.linkedBabies().map((item) => item.baby.id);
    const referenceIds = references.map((item) => item['id']);

    if (
      (activeBabyId && !referenceIds.includes(activeBabyId)) ||
      knownIds.some((id) => !referenceIds.includes(id))
    ) {
      throw new Error('A lista de bebês está incompleta. A pré-verificação foi cancelada.');
    }

    const babies: DeletionBabyPreview[] = [];
    const seen = new Set<string>();

    for (const reference of references) {
      const id = reference['id'];

      if (typeof id !== 'string' || !id.trim() || id.includes('/')) {
        throw new Error('Foi encontrado um vínculo inválido. A pré-verificação foi cancelada.');
      }

      if (seen.has(id)) {
        throw new Error('Foi encontrado um vínculo duplicado. A pré-verificação foi cancelada.');
      }

      seen.add(id);
      const membership = await this.firestore.getFromServer(`babies/${id}/members/${uid}`);
      this.assertSession(uid);

      if (!membership || (membership['role'] !== 'owner' && membership['role'] !== 'caregiver')) {
        throw new Error('Seu vínculo com um bebê mudou. Reinicie a pré-verificação.');
      }

      if (reference['role'] !== membership['role']) {
        throw new Error('Há divergência de permissões. A pré-verificação foi cancelada.');
      }

      const baby = await this.firestore.getFromServer(`babies/${id}`);
      this.assertSession(uid);

      if (!baby || typeof baby['name'] !== 'string' || !baby['name'].trim()) {
        throw new Error('Um bebê vinculado não está disponível. Tente novamente.');
      }

      const members = await this.firestore.listFromServer(`babies/${id}/members`);
      this.assertSession(uid);

      const ownMember = members.find((item) => item['id'] === uid);

      if (!ownMember || ownMember['role'] !== membership['role']) {
        throw new Error('Os vínculos foram alterados. Reinicie a pré-verificação.');
      }

      if (members.some((item) => item['role'] !== 'owner' && item['role'] !== 'caregiver')) {
        throw new Error('Foi encontrado um vínculo inválido. A pré-verificação foi cancelada.');
      }

      babies.push({
        id,
        name: baby['name'],
        role: membership['role'],
        otherCaregivers: members.filter((item) => item['id'] !== uid).length,
      });
    }

    // Prévia apenas informativa: o backend deverá refazer a verificação
    // de todos os vínculos, inclusive eventuais referências órfãs.
    for (const baby of babies) {
      const current = await this.firestore.getFromServer(`babies/${baby.id}/members/${uid}`);
      this.assertSession(uid);

      if (current?.['role'] !== baby.role) {
        throw new Error('Seu vínculo mudou. Reinicie a pré-verificação.');
      }
    }

    return {
      babies,
      requiresOwnerDecision: babies.some((baby) => baby.role === 'owner'),
    };
  }

  private assertSession(uid: string): void {
    if (this.auth.user()?.uid !== uid) {
      throw new Error('A conta mudou. Nenhuma pré-verificação foi concluída.');
    }
  }
}
