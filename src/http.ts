import { createServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createSeerfarServer } from './server.js';
import type { ServerOptions } from './server.js';

export function createHttpServer(options: Omit<ServerOptions, 'headerKey' | 'headerKeyAllowed'>) {
  const handler = createMcpHandler((context) => createSeerfarServer({ ...options,
    headerKeyAllowed: true, headerKey: context.requestInfo?.headers.get('x-seerfar-api-key') ?? undefined,
  }));
  const nodeHandler = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const server = createServer((request, response) => {
    if (!validateHost(request, response) || !validateOrigin(request, response)) return;
    if (request.url === '/health' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok', snapshotId: options.snapshot.id }));
      return;
    }
    if (request.url !== '/mcp') { response.writeHead(404).end(); return; }
    void nodeHandler(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'MCP 请求处理失败。' }));
    });
  });
  server.on('close', () => { void handler.close(); });
  return server;
}
