import type { ApiArguments, Endpoint, JsonObject } from './types.js';

export interface ClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  /** WorkBuddy 插件设置注入的 Key，作为工具参数/HTTP 请求头之外的兜底。 */
  envKey?: string;
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
  if (!key || /\s/.test(key) || key.includes('${')) throw new Error('请提供有效的 Seerfar API Key（WorkBuddy 插件设置或 apiKey 参数）。');
  return key;
}

function scrub(value: unknown, keys: string[]): unknown {
  if (typeof value === 'string') {
    return keys.reduce((text, key) => text.split(key).join('[REDACTED]').split(encodeURIComponent(key)).join('[REDACTED]'), value);
  }
  if (Array.isArray(value)) return value.map((item) => scrub(item, keys));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [scrub(name, keys) as string, scrub(item, keys)]));
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
  readonly envKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://api.seerfar.cn';
    const url = new URL(this.baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('无效的 API Base URL');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('请求超时必须是正整数毫秒');
    this.fetcher = options.fetcher ?? fetch;
    if (options.envKey) {
      try { this.envKey = normalizeApiKey(options.envKey); } catch { this.envKey = undefined; }
    }
  }

  async execute(endpoint: Endpoint, args: ApiArguments, headerKey?: string, signal?: AbortSignal): Promise<ApiResult> {
    let key: string;
    try { key = normalizeApiKey(args.apiKey ?? headerKey ?? this.envKey); }
    catch { return { isError: true, error: { kind: 'authentication', message: '本次调用缺少有效 API Key。请在 WorkBuddy 插件设置中填写 Seerfar API Key，或通过 apiKey 参数传入。' } }; }
    const sensitiveKeys = [...new Set([key, this.envKey].filter((item): item is string => Boolean(item)))];
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
        response: scrub(payload, sensitiveKeys), ...(response.headers.has('retry-after') ? { retryAfter: response.headers.get('retry-after')! } : {}) };
    } catch {
      const kind = timeout.aborted ? 'timeout' : signal?.aborted ? 'cancelled' : 'request_failed';
      return { isError: true, error: { kind, message: kind === 'timeout' ? 'Seerfar API 请求超时；未自动重试。' : kind === 'cancelled' ? '请求已取消。' : 'Seerfar API 请求失败；未自动重试。' } };
    }
  }
}
