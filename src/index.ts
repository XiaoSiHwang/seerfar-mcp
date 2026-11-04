#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { SeerfarClient } from './api-client.js';
import { createSeerfarServer } from './server.js';
import { createHttpServer } from './http.js';
import { loadSnapshot } from './snapshots.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    transport: { type: 'string', default: 'stdio' }, port: { type: 'string', default: '3000' },
    'base-url': { type: 'string' }, 'timeout-ms': { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Seerfar API MCP\n用法：node dist/src/index.js [--transport stdio|http] [--port 3000] [--base-url URL] [--timeout-ms 30000]\nAPI Key 由每次工具调用的 apiKey 参数提供；HTTP 也支持 X-Seerfar-Api-Key。');
    return;
  }
  if (!['stdio', 'http'].includes(values.transport!)) throw new Error('transport 必须是 stdio 或 http');
  const options = { snapshot: await loadSnapshot(), client: new SeerfarClient({
    baseUrl: values['base-url'] ?? process.env.SEERFAR_BASE_URL,
    timeoutMs: Number(values['timeout-ms'] ?? process.env.SEERFAR_TIMEOUT_MS ?? 30000),
  }) };
  if (values.transport === 'stdio') {
    const handle = serveStdio(() => createSeerfarServer(options));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void handle.close(); });
    return;
  }
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须为 1～65535');
  const server = createHttpServer(options);
  server.on('error', () => { console.error('HTTP 服务启动失败，请检查端口是否被占用。'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.error(`Seerfar MCP 已启动：http://127.0.0.1:${port}/mcp`));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { server.close(); server.closeAllConnections(); });
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : '启动失败'); process.exitCode = 1; });
