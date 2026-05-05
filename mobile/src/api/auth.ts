import { requestJson } from './httpClient';

export type AuthUser = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  provider: string;
  createdAt: string;
};

export type AuthSession = {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
};

export function loginWithGoogleIdToken(idToken: string) {
  return requestJson<AuthSession>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

export function fetchMe(token: string) {
  return requestJson<AuthUser>('/auth/me', { token });
}
