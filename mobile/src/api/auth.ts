import { requestJson } from './httpClient';

export type AuthUser = {
  id: string;
  nickname: string;
  email: string | null;
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

export function updateProfile(
  payload: { nickname: string; profileImageUrl: string | null },
  token: string,
) {
  return requestJson<AuthUser>('/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  });
}

export function uploadProfileImage(
  asset: { uri: string; fileName?: string | null; type?: string | null },
  token: string,
) {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? 'profile-image.jpg',
    type: asset.type ?? 'image/jpeg',
  } as unknown as Blob);

  return requestJson<AuthUser>('/auth/me/profile-image', {
    method: 'POST',
    token,
    body: form,
  });
}
