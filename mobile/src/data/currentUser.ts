export const LOCAL_MOCK_USER_ID = 'mock-user-1';
export const BACKEND_LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

export function getCurrentUserId(sessionUserId?: string | null) {
  return sessionUserId ?? BACKEND_LOCAL_USER_ID;
}

export function isCurrentUserId(
  userId: string,
  sessionUserId?: string | null,
) {
  return (
    userId === sessionUserId ||
    userId === BACKEND_LOCAL_USER_ID ||
    userId === LOCAL_MOCK_USER_ID
  );
}
