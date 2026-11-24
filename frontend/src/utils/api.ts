import type {
  ApiErrorOptions,
  HeaderMap,
  QueryParams,
  QueryPrimitive,
  RequestBody,
  RequestOptions,
  ResponseType,
  TokenManager,
} from '../types/api';

export const API_BASE = import.meta.env.VITE_API_BASE || '';

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const tokenManager: TokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken, refreshToken) => {
    if (accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  hasTokens: () => Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)),
};

let refreshPromise: Promise<string> | null = null;
let onTokenExpired: (() => void) | null = null;

function readMessageField(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.message === 'string') {
    return record.message;
  }
  if (typeof record.error === 'string') {
    return record.error;
  }

  return undefined;
}

function readCodeField(data: unknown): string | number | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.code === 'string' || typeof record.code === 'number') {
    return record.code;
  }

  return undefined;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenManager.getRefreshToken();

  if (!refreshToken) {
    throw new Error('登录状态已失效，请重新登录');
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(readMessageField(errorBody) || '登录状态已失效，请重新登录');
      }

      const data = (await response.json()) as Record<string, unknown>;
      const nextAccessToken =
        typeof data.accessToken === 'string'
          ? data.accessToken
          : typeof data.token === 'string'
            ? data.token
            : null;
      const nextRefreshToken =
        typeof data.refreshToken === 'string' ? data.refreshToken : null;

      tokenManager.setTokens(nextAccessToken, nextRefreshToken);

      if (!nextAccessToken) {
        throw new Error('登录状态已失效，请重新登录');
      }

      return nextAccessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setOnTokenExpired(callback: (() => void) | null): void {
  onTokenExpired = callback;
}

export class ApiError extends Error {
  status?: number;
  code?: string | number;
  data?: unknown;

  constructor(message: string, { status, code, data }: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const hasHeader = (headers: HeaderMap, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

const isFormData = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;

const isArrayBufferView = (value: unknown): value is ArrayBufferView =>
  typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value);

const buildUrl = (path?: string): string => {
  if (!path) {
    return API_BASE;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${API_BASE}${path}`;
};

const prepareBody = (
  body: RequestBody,
  headers: HeaderMap,
  options: RequestOptions,
): { body: BodyInit | undefined; headers: HeaderMap } => {
  if (body === undefined || body === null) {
    return { body: undefined, headers };
  }

  if (options.isFormData || isFormData(body)) {
    return { body: body as FormData, headers };
  }

  if (isBlob(body) || isArrayBuffer(body) || body instanceof URLSearchParams) {
    return { body, headers };
  }

  if (isArrayBufferView(body)) {
    if (body.buffer instanceof ArrayBuffer) {
      return {
        body: body.buffer.slice(
          body.byteOffset,
          body.byteOffset + body.byteLength,
        ),
        headers,
      };
    }

    return { body: String(body), headers };
  }

  if (typeof body === 'string') {
    return { body, headers };
  }

  if (typeof body === 'number' || typeof body === 'boolean') {
    return { body: String(body), headers };
  }

  if (Array.isArray(body) || isPlainObject(body)) {
    if (!hasHeader(headers, 'Content-Type')) {
      headers['Content-Type'] = 'application/json';
    }
    return { body: JSON.stringify(body), headers };
  }

  return { body: String(body), headers };
};

const readBodyAsJsonOrText = async (
  response: Response,
): Promise<{ data: unknown; text: string }> => {
  const text = await response.text().catch(() => '');
  if (!text) {
    return { data: null, text: '' };
  }

  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
};

const parseResponseBody = async <T>(
  response: Response,
  responseType: ResponseType = 'json',
): Promise<T> => {
  if (response.status === 204) {
    return null as T;
  }

  if (responseType === 'blob') {
    return response.blob() as Promise<T>;
  }
  if (responseType === 'arraybuffer') {
    return response.arrayBuffer() as Promise<T>;
  }
  if (responseType === 'text') {
    return response.text() as Promise<T>;
  }

  const { data, text } = await readBodyAsJsonOrText(response);
  if (data === null && text !== '') {
    throw new ApiError('服务器返回数据异常，请稍后再试', {
      status: response.status,
      data: text,
    });
  }
  return data as T;
};

const parseErrorResponse = async (
  response: Response,
): Promise<{ message: string; data: unknown }> => {
  const { data, text } = await readBodyAsJsonOrText(response);
  return {
    message:
      readMessageField(data) || text || response.statusText || '请求失败',
    data,
  };
};

export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    headers: optionHeaders = {},
    body,
    responseType = 'json',
    auth = true,
    retry = true,
    signal,
  } = options;

  const headers: HeaderMap = { ...optionHeaders };
  if (auth && !hasHeader(headers, 'Authorization')) {
    const accessToken = tokenManager.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  const usedAuth = hasHeader(headers, 'Authorization');
  const wantsAuth = auth || usedAuth;
  const { body: preparedBody, headers: preparedHeaders } = prepareBody(
    body,
    headers,
    options,
  );

  const finalMethod = method.toUpperCase();
  const fetchOptions: RequestInit = {
    method: finalMethod,
    headers: preparedHeaders,
    signal,
  };
  if (finalMethod !== 'GET' && finalMethod !== 'HEAD') {
    fetchOptions.body = preparedBody;
  }

  const url = buildUrl(path);
  let response = await fetch(url, fetchOptions);

  const isRefreshRequest = url.includes('/api/auth/refresh');
  if (
    response.status === 401 &&
    retry &&
    wantsAuth &&
    !isRefreshRequest &&
    tokenManager.getRefreshToken()
  ) {
    try {
      const newAccessToken = await refreshAccessToken();
      preparedHeaders.Authorization = `Bearer ${newAccessToken}`;
      response = await fetch(url, {
        ...fetchOptions,
        headers: preparedHeaders,
      });
    } catch (refreshError) {
      tokenManager.clearTokens();
      onTokenExpired?.();
      throw new ApiError('登录已过期，请重新登录', {
        status: 401,
        data: refreshError,
      });
    }
  }

  if (!response.ok) {
    const { message, data } = await parseErrorResponse(response);

    if (response.status === 401 && wantsAuth) {
      tokenManager.clearTokens();
      onTokenExpired?.();
    }

    throw new ApiError(message, {
      status: response.status,
      code: readCodeField(data),
      data,
    });
  }

  return parseResponseBody<T>(response, responseType);
}

export async function apiRequestWithRefresh<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return request(path, {
    ...options,
    auth: true,
    retry: options.retry ?? true,
  });
}

export async function apiRequest<T = unknown>(
  path: string,
  token: string | null,
  options: RequestOptions = {},
): Promise<T> {
  const headers: HeaderMap = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return request<T>(path, {
    ...options,
    headers,
    auth: false,
    retry: options.retry ?? true,
  });
}

export const buildQueryString = (params: QueryParams = {}): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }

      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          searchParams.append(key, String(item as QueryPrimitive));
        }
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  return searchParams.toString();
};
