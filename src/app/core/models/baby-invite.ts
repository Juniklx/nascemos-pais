export type BabyInviteStatus =
  | 'pending'
  | 'accepted';

export interface BabyInvite {
  readonly id: string;

  readonly babyId: string;

  readonly createdByUid:
    string;

  readonly createdAt:
    number;

  readonly expiresAt:
    number;

  readonly status:
    BabyInviteStatus;

  readonly acceptedByUid:
    string | null;

  readonly acceptedAt:
    number | null;
}