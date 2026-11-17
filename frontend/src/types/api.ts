export type ResponseType = 'json' | 'blob' | 'arraybuffer' | 'text';
export type QueryPrimitive = string | number | boolean;
export type QueryValue =
  | QueryPrimitive
  | QueryPrimitive[]
  | null
  | undefined;
export type QueryParams = Record<string, QueryValue>;
export type RequestBody = unknown;
export type HeaderMap = Record<string, string>;

export interface RequestOptions {
  method?: string;
  headers?: HeaderMap;
  body?: RequestBody;
  responseType?: ResponseType;
  auth?: boolean;
  retry?: boolean;
  signal?: AbortSignal;
  isFormData?: boolean;
}

export interface ApiErrorOptions {
  status?: number;
  code?: string | number;
  data?: unknown;
}

export interface TokenManager {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken?: string | null, refreshToken?: string | null) => void;
  clearTokens: () => void;
  hasTokens: () => boolean;
}
