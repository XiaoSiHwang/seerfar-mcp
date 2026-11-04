import type { ApiArguments, Endpoint, JsonObject } from './types.js';

export interface ClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export interface ApiResult {
  isError: boolean;
  httpStatus?: number;
  response?: unknown;
  retryAfter?: string;
  error?: { kind: string; message: string };
}

export function normalizeApiKey(value?: string): string {
  const key = value?.trim().replace(/^Bearer\s+/i, '') ?? '';
  if (!key || /\s/.test(key)) throw new Error('请为本次调用提供有效的 apiKey 或 X-Seerfar-Api-Key 请求头。');
  return key;
}

function scrub(value: unknown, key: string): unknown {
  if (typeof value === 'string') return value.split(key).join('[REDACTED]').split(encodeURIComponent(key)).join('[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => scrub(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [scrub(name, key) as string, scrub(item, key)]));
  }
  return value;
}

function requestUrl(baseUrl: string, endpoint: Endpoint, args: ApiArguments): URL {
  let path = endpoint.path;
  for (const param of endpoint.pathParams ?? []) {
    const value = args.path?.[param.name];
    if (value === undefined && param.required) throw new Error(`缺少路径参数：${param.name}`);
    path = path.replaceAll(`{${param.name}}`, encodeURIComponent(String(value ?? '')));
  }
  if (/[{}?#]/.test(path) || !path.startsWith('/open-api/') || path.split('/').some((part) => ['.', '..'].includes(part))) {
    throw new Error('接口路径无效');
  }
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`);
  for (const [name, value] of Object.entries(args.query ?? {})) {
    if (value === null || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(name, typeof item === 'object' ? JSON.stringify(item) : String(item));
  }
  return url;
}

function requestHeaders(endpoint: Endpoint, args: ApiArguments, key: string): Headers {
  const headers = new Headers({ Authorization: `Bearer ${key}`, Accept: 'application/json' });
  const allowed = new Set((endpoint.headerParams ?? []).map((p) => p.name.toLowerCase()));
  for (const [name, value] of Object.entries(args.headers ?? {})) {
    if (['authorization', 'content-type', 'host'].includes(name.toLowerCase()) || !allowed.has(name.toLowerCase())) {
      throw new Error(`不允许覆盖请求头：${name}`);
    }
    headers.set(name, value);
  }
  if (args.body !== undefined) headers.set('Content-Type', 'application/json');
  return headers;
}

export class SeerfarClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://api.seerfar.cn';
    const url = new URL(this.baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('无效的 API Base URL');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('请求超时必须是正整数毫秒');
    this.fetcher = options.fetcher ?? fetch;
  }

  async execute(endpoint: Endpoint, args: ApiArguments, headerKey?: string, signal?: AbortSignal): Promise<ApiResult> {
    let key: string;
    try { key = normalizeApiKey(args.apiKey ?? headerKey); }
    catch { return { isError: true, error: { kind: 'authentication', message: '本次调用缺少有效 API Key。' } }; }
    const timeout = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await this.fetcher(requestUrl(this.baseUrl, endpoint, args), {
        method: endpoint.method, headers: requestHeaders(endpoint, args, key),
        body: args.body === undefined ? undefined : JSON.stringify(args.body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        redirect: 'error',
      });
      let payload: unknown;
      try { payload = await response.json(); }
      catch {
        if (timeout.aborted || signal?.aborted) throw new Error('aborted');
        return { isError: true, httpStatus: response.status, error: { kind: 'invalid_response', message: '上游返回了非 JSON 响应。' } };
      }
      const code = payload && typeof payload === 'object' ? (payload as JsonObject).code : undefined;
      return { isError: !response.ok || (code !== undefined && String(code) !== '200'), httpStatus: response.status,
        response: scrub(payload, key), ...(response.headers.has('retry-after') ? { retryAfter: response.headers.get('retry-after')! } : {}) };
    } catch {
      const kind = timeout.aborted ? 'timeout' : signal?.aborted ? 'cancelled' : 'request_failed';
      return { isError: true, error: { kind, message: kind === 'timeout' ? 'Seerfar API 请求超时；未自动重试。' : kind === 'cancelled' ? '请求已取消。' : 'Seerfar API 请求失败；未自动重试。' } };
    }
  }
}
