import { API_BASE_URL } from '../config/env';

type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await sendRequest(path, options);
  return response.json() as Promise<T>;
}

export async function requestVoid(
  path: string,
  options: RequestOptions = {},
): Promise<void> {
  await sendRequest(path, options);
}

async function sendRequest(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(getErrorMessage(response.status, body));
  }

  return response;
}

function getErrorMessage(status: number, body: string) {
  if (!body) {
    return `Request failed: ${status}`;
  }

  try {
    const data = JSON.parse(body) as { detail?: unknown };
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail
        .map(item => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String(item.msg);
          }
          return JSON.stringify(item);
        })
        .join('\n');
    }
  } catch {
    // Fall through to the raw response body.
  }

  return body;
}
