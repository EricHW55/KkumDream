export interface GroupMember {
  id: string;
  name: string;
  avatarColor: string;
  profileImageUrl?: string | null;
  role?: string;
}

export interface GroupRoom {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  lastActivityLabel: string;
  unreadCount: number;
  memberIds: string[];
  members: GroupMember[];
  latestDreamId: string | null;
  todayGiverIds: string[];
}

export interface GroupDreamMessage {
  id: string;
  groupId: string;
  senderId: string;
  dreamId: string;
  sentAtLabel: string;
}
