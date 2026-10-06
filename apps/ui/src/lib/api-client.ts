/**
 * The one way `apps/ui` calls the Beztack API.
 *
 * `requestJson` resolves with the parsed body of a successful response and
 * rejects with an `ApiError` for any non-2xx response, so every page handles
 * API failures the same way: branch on `statusCode`, show `message`, read the
 * server's `data` when the route attaches one.
 *
 * Ported from lncd `apps/ui/src/lib/api-client.ts`.
 */
import { env } from "@/env";

const REQUEST_FAILED = "Request failed";

type ErrorBody = {
  message?: string;
  statusMessage?: string;
  data?: unknown;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly statusMessage: string | undefined;
  readonly data: unknown;

  constructor(
    message: string,
    opts: { statusCode: number; statusMessage?: string; data?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = opts.statusCode;
    this.statusMessage = opts.statusMessage;
    this.data = opts.data;
  }
}

export const apiUrl = (path: string): string => `${env.VITE_API_URL}${path}`;

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as ErrorBody) : {};
  } catch {
    return {};
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    const message = body.message || body.statusMessage || REQUEST_FAILED;
    throw new ApiError(message, {
      statusCode: response.status,
      statusMessage: response.statusText || body.statusMessage,
      data: body.data,
    });
  }

  return (await response.json()) as T;
}
