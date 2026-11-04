import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { createHttpServer } from '../src/http.js';
import { SeerfarClient } from '../src/api-client.js';
import { loadSnapshot, ROOT } from '../src/snapshots.js';
import { toolName } from '../src/schema.js';

const snapshot = await loadSnapshot();

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
}

function decode(response: CallToolResult): Record<string, unknown> {
  const content = response.content[0];
  assert.ok(content && content.type === 'text');
  return JSON.parse(content.text) as Record<string, unknown>;
}

function childEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  delete env.SEERFAR_API_KEY;
  return { ...env, ...extra };
}

async function requestWithHost(url: string, host: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: { Host: host } }, (response) => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', reject); req.end();
  });
}

for (const modern of [false, true]) {
  test(`stdio ${modern ? '2026 协议' : '2025 协议'}：真实客户端连接并调用全部 41 个工具`, async () => {
    const requests: { method?: string; url?: string; key?: string; body: unknown }[] = [];
    const upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const bodyText = Buffer.concat(chunks).toString();
      requests.push({ method: request.method, url: request.url, key: request.headers.authorization, body: bodyText ? JSON.parse(bodyText) : undefined });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ code: 200, msg: 'SUCCESS', data: { path: request.url } }));
    });
    const baseUrl = await listen(upstream);
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [`${ROOT}/dist/src/index.js`, '--base-url', baseUrl], cwd: tmpdir(), stderr: 'pipe', env: childEnv() });
    const client = new Client({ name: 'seerfar-test', version: '1.0.0' }, modern ? { versionNegotiation: { mode: 'auto' } } : {});
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.equal(tools.length, 45);
      assert.equal((await client.listResources()).resources.length, 3);
      const info = await client.readResource({ uri: 'seerfar://api/version' });
      assert.ok(JSON.stringify(info).includes(snapshot.id));
      for (const [index, endpoint] of snapshot.sources.config.endpoints.entries()) {
        assert.ok(tools.some((tool) => tool.name === toolName(endpoint)));
        const result = await client.callTool({ name: toolName(endpoint), arguments: { apiKey: `fake-call-key-${index}`, ...(endpoint.bodyExample ? { body: endpoint.bodyExample } : {}) } });
        assert.equal(result.isError, false, JSON.stringify(result));
        assert.equal(decode(result).httpStatus, 200);
        assert.deepEqual(requests.at(-1), { method: endpoint.method, url: endpoint.path,
          key: `Bearer fake-call-key-${index}`, body: endpoint.bodyExample });
      }
      assert.equal(requests.length, 41);
      const version = decode(await client.callTool({ name: 'seerfar_api_version', arguments: {} }));
      assert.equal(version.snapshotId, snapshot.id);
      const bad = await client.callTool({ name: 'seerfar_quota', arguments: {} });
      assert.equal(bad.isError, true); assert.equal(requests.length, 41);
      const doc = decode(await client.callTool({ name: 'seerfar_get_api_doc', arguments: { id: 'ozon-collect-box-page' } }));
      assert.ok(JSON.stringify(doc).includes('/open-api/collect-box/page/ozon'));
    } finally { await client.close(); await close(upstream); }
  });
}

test('WorkBuddy 插件注入 SEERFAR_API_KEY 后可直接调用，不接受工具参数 Key，工具注解符合审批模式', async () => {
  const seen: string[] = [];
  const upstream = createServer(async (request, response) => {
    for await (const _chunk of request) { /* drain */ }
    seen.push(String(request.headers.authorization));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ code: 200, data: { ok: true } }));
  });
  const baseUrl = await listen(upstream);
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [`${ROOT}/dist/src/index.js`, '--base-url', baseUrl], cwd: tmpdir(), stderr: 'pipe',
    env: childEnv({ SEERFAR_API_KEY: 'plugin-env-key' }) });
  const client = new Client({ name: 'seerfar-workbuddy-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 45);
    const quotaTool = tools.find((tool) => tool.name === 'seerfar_quota')!;
    assert.ok(!quotaTool.inputSchema.required?.includes('apiKey'));
    assert.equal(quotaTool.inputSchema.properties?.apiKey, undefined);
    assert.equal(quotaTool.annotations?.readOnlyHint, true);
    assert.equal(quotaTool.annotations?.idempotentHint, true);
    const collectTool = tools.find((tool) => tool.name === 'seerfar_ozon_product_collect')!;
    assert.equal(collectTool.annotations?.readOnlyHint, false);
    assert.equal(collectTool.annotations?.destructiveHint, false);
    assert.equal(collectTool.annotations?.idempotentHint, false);
    assert.equal(collectTool.annotations?.openWorldHint, true);

    const configured = await client.callTool({ name: 'seerfar_quota', arguments: {} });
    assert.equal(configured.isError, false);
    assert.equal(seen.at(-1), 'Bearer plugin-env-key');

    const rejected = await client.callTool({ name: 'seerfar_quota', arguments: { apiKey: 'override-key' } });
    assert.equal(rejected.isError, true);
    assert.equal(seen.length, 1);

    const version = decode(await client.callTool({ name: 'seerfar_api_version', arguments: {} }));
    assert.equal(version.apiKeyConfigured, true);

    const doc = decode(await client.callTool({ name: 'seerfar_get_api_doc', arguments: { id: 'quota' } }));
    const docSchema = doc.inputSchema as { required?: string[] };
    assert.ok(!docSchema.required?.includes('apiKey'));
  } finally { await client.close(); await close(upstream); }
});

for (const modern of [false, true]) {
  test(`HTTP ${modern ? '2026 协议' : '2025 协议'}：请求头与参数传 Key，跨请求隔离和并发`, async () => {
    const seen: string[] = [];
    const api = new SeerfarClient({ fetcher: async (_url, options) => {
      seen.push(new Headers(options?.headers).get('Authorization')!);
      return new Response(JSON.stringify({ code: 200, data: { ok: true } }));
    } });
    const server = createHttpServer({ snapshot, client: api, sourceFetcher: async () => snapshot.sources });
    const url = await listen(server);
    const clients: Client[] = [];
    try {
      for (const key of ['header-one', 'header-two', undefined]) {
        const client = new Client({ name: 'http-test', version: '1.0.0' }, modern ? { versionNegotiation: { mode: 'auto' } } : {});
        clients.push(client);
        await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
          requestInit: key ? { headers: { 'X-Seerfar-Api-Key': key } } : {},
        }));
      }
      const responses = await Promise.all(clients.map((client, index) => client.callTool({ name: 'seerfar_quota', arguments: index === 2 ? { apiKey: 'argument-three' } : {} })));
      assert.ok(responses.every((response) => !response.isError));
      assert.deepEqual(seen.sort(), ['Bearer header-one', 'Bearer header-two', 'Bearer argument-three'].sort());
      await clients[0]!.callTool({ name: 'seerfar_quota', arguments: { apiKey: 'explicit-override' } });
      assert.equal(seen.at(-1), 'Bearer explicit-override');
      const missing = await clients[2]!.callTool({ name: 'seerfar_quota', arguments: {} });
      assert.equal(missing.isError, true); assert.equal(seen.length, 4);
      const check = decode(await clients[0]!.callTool({ name: 'seerfar_check_api_updates', arguments: {} }));
      assert.equal(check.hasChanges, false);
      assert.equal((await fetch(`${url}/health`)).status, 200);
      assert.equal((await fetch(`${url}/mcp`, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
      assert.equal(await requestWithHost(`${url}/mcp`, 'untrusted.example'), 403);
      assert.equal((await fetch(`${url}/unknown`)).status, 404);
    } finally { await Promise.all(clients.map((client) => client.close())); await close(server); }
  });
}
