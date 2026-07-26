import { DEFAULT_API_BASE_URL } from "@/lib/constants";
import {
  clearAuthData,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth/auth-storage";
import { ApiError, normalizeApiError } from "@/lib/api/errors";
import type { JsonValue } from "@/types/api";

type ApiRequestBody = BodyInit | JsonValue;

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: ApiRequestBody;
  skipAuth?: boolean;
  token?: string | null;
}

type TokenRefreshResponse = {
  access: string;
  refresh?: string;
};

let tokenRefreshPromise: Promise<string> | null = null;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

function buildApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\//, "");

  return `${baseUrl}/${normalizedPath}`;
}

function isBodyInit(body: ApiRequestBody): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  );
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const message = payload.trim();
    return message.length > 0 ? message : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = extractErrorMessage(item);

      if (message) {
        return message;
      }
    }

    return null;
  }

  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const preferredKeys = ["detail", "message", "non_field_errors"];

    for (const key of preferredKeys) {
      const message = extractErrorMessage(record[key]);

      if (message) {
        return message;
      }
    }

    for (const value of Object.values(record)) {
      const message = extractErrorMessage(value);

      if (message) {
        return message;
      }
    }
  }

  return null;
}

function getErrorMessage(payload: unknown, fallback: string) {
  return extractErrorMessage(payload) ?? fallback;
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function requestFreshAccessToken() {
  const currentRefreshToken = getRefreshToken();

  if (!currentRefreshToken) {
    throw new ApiError({
      message: "Your session has expired. Please log in again.",
      status: 401,
    });
  }

  const response = await fetch(buildApiUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh: currentRefreshToken,
    }),
    cache: "no-store",
  });

  const parsedBody: unknown = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError({
      message: getErrorMessage(
        parsedBody,
        "Your session has expired. Please log in again.",
      ),
      status: response.status,
      details: parsedBody,
    });
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    typeof (parsedBody as Partial<TokenRefreshResponse>).access !== "string" ||
    !(parsedBody as Partial<TokenRefreshResponse>).access
  ) {
    throw new ApiError({
      message: "The authentication server returned an invalid token response.",
      status: 401,
      details: parsedBody,
    });
  }

  const tokens = parsedBody as TokenRefreshResponse;

  saveAuthTokens({
    access: tokens.access,
    refresh: tokens.refresh ?? currentRefreshToken,
  });

  return tokens.access;
}

function refreshAccessToken() {
  if (!tokenRefreshPromise) {
    tokenRefreshPromise = requestFreshAccessToken()
      .catch((error) => {
        clearAuthData();
        throw error;
      })
      .finally(() => {
        tokenRefreshPromise = null;
      });
  }

  return tokenRefreshPromise;
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
) {
  const { body, headers, skipAuth = false, token, ...requestInit } = options;
  const baseHeaders = new Headers(headers);

  if (!baseHeaders.has("Accept")) {
    baseHeaders.set("Accept", "application/json");
  }

  let requestBody: BodyInit | undefined;

  if (body !== undefined) {
    if (isBodyInit(body)) {
      requestBody = body;
    } else {
      baseHeaders.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  const initialAccessToken =
    token !== undefined ? token : skipAuth ? null : getAccessToken();

  async function executeRequest(accessToken: string | null) {
    const requestHeaders = new Headers(baseHeaders);

    if (accessToken) {
      requestHeaders.set("Authorization", `Bearer ${accessToken}`);
    } else {
      requestHeaders.delete("Authorization");
    }

    return fetch(buildApiUrl(path), {
      ...requestInit,
      body: requestBody,
      headers: requestHeaders,
    });
  }

  try {
    let response = await executeRequest(initialAccessToken);

    const mayRefresh =
      response.status === 401 && !skipAuth && token === undefined;

    if (mayRefresh) {
      if (getRefreshToken()) {
        const freshAccessToken = await refreshAccessToken();
        response = await executeRequest(freshAccessToken);
      } else {
        clearAuthData();
      }
    }

    const parsedBody: unknown = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401 && !skipAuth && token === undefined) {
        clearAuthData();
      }

      throw new ApiError({
        message: getErrorMessage(parsedBody, response.statusText),
        status: response.status,
        details: parsedBody,
      });
    }

    return parsedBody as TResponse;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export const apiClient = {
  get: <TResponse>(path: string, options?: ApiRequestOptions) =>
    apiRequest<TResponse>(path, { ...options, method: "GET" }),
  post: <TResponse>(
    path: string,
    body?: ApiRequestBody,
    options?: ApiRequestOptions,
  ) => apiRequest<TResponse>(path, { ...options, body, method: "POST" }),
  put: <TResponse>(
    path: string,
    body?: ApiRequestBody,
    options?: ApiRequestOptions,
  ) => apiRequest<TResponse>(path, { ...options, body, method: "PUT" }),
  patch: <TResponse>(
    path: string,
    body?: ApiRequestBody,
    options?: ApiRequestOptions,
  ) => apiRequest<TResponse>(path, { ...options, body, method: "PATCH" }),
  delete: <TResponse>(path: string, options?: ApiRequestOptions) =>
    apiRequest<TResponse>(path, { ...options, method: "DELETE" }),
};
