export type BabyMemberRole = 'owner' | 'caregiver';

export interface Baby {
  readonly id: string;

  readonly name: string;

  readonly birthDate: string;

  readonly createdByUid: string;

  readonly createdAt: string;

  readonly updatedAt: string;
}

export interface BabyMember {
  readonly uid: string;
  readonly role: BabyMemberRole;
  readonly joinedAt: string;
  readonly inviteId?: string;
  readonly caregiverName?: string;
}

export interface CreateBabyInput {
  readonly name: string;

  readonly birthDate: string;
}
