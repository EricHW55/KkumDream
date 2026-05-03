export interface GroupMember {
  id: string;
  name: string;
  avatarColor: string;
}

export interface GroupRoom {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  lastActivityLabel: string;
  unreadCount: number;
  memberIds: string[];
  latestDreamId: string | null;
}

export interface GroupDreamMessage {
  id: string;
  groupId: string;
  senderId: string;
  dreamId: string;
  sentAtLabel: string;
}
