import assert from 'node:assert/strict';
import test from 'node:test';
import { SeerfarClient } from '../src/api-client.js';
import { loadSnapshot } from '../src/snapshots.js';
import type { Endpoint } from '../src/types.js';

const snapshot = await loadSnapshot();
const quota = snapshot.sources.config.endpoints.find((e) => e.id === 'quota')!;
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });

test('全部文档接口按方法、路径和原始请求体转发，密钥只进入 Authorization', async () => {
  for (const endpoint of snapshot.sources.config.endpoints) {
    let count = 0;
    const client = new SeerfarClient({ fetcher: async (url, options) => {
      count++;
      assert.equal(String(url), `https://api.seerfar.cn${endpoint.path}`);
      assert.equal(options?.method, endpoint.method);
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer fake-dynamic-key');
      assert.equal(options?.body, endpoint.bodyExample ? JSON.stringify(endpoint.bodyExample) : undefined);
      assert.equal(options?.redirect, 'error');
      assert.ok(!String(url).includes('fake-dynamic-key'));
      return json(endpoint.responseExample);
    } });
    const result = await client.execute(endpoint, { apiKey: 'fake-dynamic-key', ...(endpoint.bodyExample ? { body: endpoint.bodyExample } : {}) });
    assert.equal(result.isError, false, endpoint.id);
    assert.deepEqual(result.response, endpoint.responseExample);
    assert.equal(count, 1);
  }
});

test('同一实例并发使用不同 Key；参数优先于请求头；缺 Key 不发送请求', async () => {
  const keys: string[] = [];
  const client = new SeerfarClient({ fetcher: async (_url, options) => {
    keys.push(new Headers(options?.headers).get('Authorization')!);
    return json({ code: 200 });
  } });
  await Promise.all([
    client.execute(quota, { apiKey: 'alpha-key' }), client.execute(quota, { apiKey: 'Bearer beta-key' }),
    client.execute(quota, {}, 'header-key'), client.execute(quota, { apiKey: 'argument-key' }, 'ignored-key'),
  ]);
  assert.deepEqual(keys.sort(), ['Bearer alpha-key', 'Bearer beta-key', 'Bearer header-key', 'Bearer argument-key'].sort());
  assert.equal((await client.execute(quota, {})).isError, true);
  assert.equal((await client.execute(quota, { apiKey: 'bad\r\nkey' })).isError, true);
  assert.equal(keys.length, 4);
});

test('HTTP 错误、业务错误和限流保持错误语义且不重试', async () => {
  for (const [status, code] of [[401, 401], [403, 403], [429, 429], [500, 500], [200, 8000], [200, 6102]]) {
    let count = 0;
    const client = new SeerfarClient({ fetcher: async () => { count++; return json({ code, msg: 'upstream message' }, status, { 'Retry-After': '3' }); } });
    const response = await client.execute(quota, { apiKey: 'fake-key' });
    assert.equal(response.isError, true); assert.equal(response.httpStatus, status);
    assert.equal(response.retryAfter, '3'); assert.equal(count, 1);
    assert.deepEqual(response.response, { code, msg: 'upstream message' });
  }
});

test('上游回显密钥和网络异常不泄露 Key，非 JSON 响应不会作为成功返回', async () => {
  const client = new SeerfarClient({ fetcher: async () => json({ code: 200, data: { message: 'Bearer private-key' } }) });
  assert.ok(!JSON.stringify(await client.execute(quota, { apiKey: 'private-key' })).includes('private-key'));
  const broken = new SeerfarClient({ fetcher: async () => { throw new Error('Bearer private-key'); } });
  assert.ok(!JSON.stringify(await broken.execute(quota, { apiKey: 'private-key' })).includes('private-key'));
  const html = new SeerfarClient({ fetcher: async () => new Response('<html>gateway</html>') });
  assert.equal((await html.execute(quota, { apiKey: 'key' })).error?.kind, 'invalid_response');
});

test('超时与取消传播至请求，不自动重试', async () => {
  let calls = 0;
  const client = new SeerfarClient({ timeoutMs: 10, fetcher: (_url, options) => new Promise((_resolve, reject) => {
    calls++;
    options?.signal?.addEventListener('abort', () => reject(new Error('abort')), { once: true });
    setTimeout(() => reject(new Error('fixture timeout')), 100);
  }) });
  assert.equal((await client.execute(quota, { apiKey: 'key' })).error?.kind, 'timeout');
  assert.equal(calls, 1);
  const controller = new AbortController(); controller.abort();
  const cancelled = new SeerfarClient({ fetcher: async (_url, options) => { options?.signal?.throwIfAborted(); return json({ code: 200 }); } });
  assert.equal((await cancelled.execute(quota, { apiKey: 'key' }, undefined, controller.signal)).error?.kind, 'cancelled');
});

test('路径参数编码、查询数组、声明的请求头可用，Authorization 不能覆盖', async () => {
  const endpoint: Endpoint = { ...quota, path: '/open-api/example/{id}', pathParams: [{ name: 'id', docType: 'string', required: true }],
    headerParams: [{ name: 'X-Language', docType: 'string' }] };
  let calls = 0;
  const client = new SeerfarClient({ fetcher: async (url, options) => {
    calls++;
    const parsed = new URL(String(url)); assert.equal(parsed.pathname, '/open-api/example/a%2Fb');
    assert.deepEqual(parsed.searchParams.getAll('x'), ['1', '2']); assert.equal(parsed.searchParams.has('empty'), false);
    assert.equal(new Headers(options?.headers).get('X-Language'), 'CN'); return json({ code: 200 });
  } });
  assert.equal((await client.execute(endpoint, { apiKey: 'key', path: { id: 'a/b' }, query: { x: [1, 2], empty: null }, headers: { 'X-Language': 'CN' } })).isError, false);
  assert.equal((await client.execute(endpoint, { apiKey: 'key', path: { id: 'a/b' }, headers: { Authorization: 'evil' } })).isError, true);
  assert.equal(calls, 1);
});
