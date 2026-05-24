export interface OnlineUser {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  joinedAt: number;
}

export interface CurrentUserIdentity {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}
