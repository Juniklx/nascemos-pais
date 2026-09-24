export interface BabyAccessRemovedNotification {
  readonly id: string;
  readonly type: 'baby-access-removed';
  readonly babyId: string;
  readonly babyName: string;
  readonly createdAt: number;
  readonly readAt: number | null;
}