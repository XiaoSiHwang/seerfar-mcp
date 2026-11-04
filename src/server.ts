import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { SeerfarClient } from './api-client.js';
import { inputSchema, objectSchema, toolName } from './schema.js';
import { compareSnapshots, pricingFor, snapshotInfo } from './versions.js';
import { fetchSources, makeSnapshot } from './snapshots.js';
import { zh } from './types.js';
import type { ApiArguments, JsonSchema, Snapshot, Sources } from './types.js';

export interface ServerOptions {
  snapshot: Snapshot;
  client: SeerfarClient;
  headerKey?: string;
  headerKeyAllowed?: boolean;
  sourceFetcher?: () => Promise<Sources>;
}

function result(value: unknown, isError = false): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError };
}

function localize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(localize);
  if (!value || typeof value !== 'object') return value;
  if ('zh-CN' in value) return (value as Record<string, unknown>)['zh-CN'];
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item)]));
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function registerApiTools(server: McpServer, options: ServerOptions): void {
  for (const endpoint of options.snapshot.sources.config.endpoints) {
    const price = pricingFor(options.snapshot, endpoint);
    const creates = /product-collect$|review-analyse-task-add$/.test(endpoint.id);
    server.registerTool(toolName(endpoint), {
      title: zh(endpoint.label),
      description: `${zh(endpoint.description)}\n${endpoint.method} ${endpoint.path}\n费用：${zh(price?.credits ?? endpoint.credits)}；频率：${zh(price?.callCount)}。失败不会自动重试。`,
      inputSchema: fromJsonSchema<ApiArguments>(inputSchema(endpoint, options.headerKeyAllowed)),
      annotations: { readOnlyHint: !creates, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args, context) => {
      const response = await options.client.execute(endpoint, args, options.headerKey, context.mcpReq.signal);
      return result(response, response.isError);
    });
  }
}

function registerCatalogTools(server: McpServer, snapshot: Snapshot): void {
  const filterSchema: JsonSchema = { ...objectSchema(false), properties: { keyword: { type: 'string', description: '按 ID、名称或路径筛选' } } };
  server.registerTool('seerfar_list_apis', { description: '列出当前版本支持的全部 Seerfar API 及工具名、费用和频率，无需 API Key。',
    inputSchema: fromJsonSchema<{ keyword?: string }>(filterSchema), annotations: readOnly }, async ({ keyword }) => {
    const endpoints = snapshot.sources.config.endpoints.filter((e) => `${e.id} ${e.path} ${zh(e.label)}`.toLowerCase().includes(keyword?.toLowerCase() ?? ''));
    return result(endpoints.map((e) => ({ id: e.id, tool: toolName(e), label: zh(e.label), method: e.method, path: e.path, pricing: localize(pricingFor(snapshot, e)) })));
  });
  server.registerTool('seerfar_get_api_doc', { description: '查询接口的完整请求参数、必填条件、响应字段、示例、费用及错误说明，无需 API Key。',
    inputSchema: fromJsonSchema<{ id: string }>({ ...objectSchema(false), properties: { id: { type: 'string' } }, required: ['id'] }), annotations: readOnly }, async ({ id }) => {
    const endpoint = snapshot.sources.config.endpoints.find((e) => e.id === id || toolName(e) === id);
    return endpoint ? result({ snapshotId: snapshot.id, endpoint: localize(endpoint), pricing: localize(pricingFor(snapshot, endpoint)), inputSchema: inputSchema(endpoint) })
      : result({ error: '接口不存在，请先调用 seerfar_list_apis。' }, true);
  });
}

function registerVersionTools(server: McpServer, options: ServerOptions): void {
  const info = { ...snapshotInfo(options.snapshot), mcpVersion: '0.1.0', apiBaseUrl: options.client.baseUrl };
  server.registerTool('seerfar_api_version', { description: '查看 MCP 版本、当前 API 文档快照、内容哈希及上游更新日期。',
    inputSchema: fromJsonSchema(objectSchema(false)), annotations: readOnly }, async () => result(info));
  server.registerTool('seerfar_check_api_updates', { description: '在线读取官方文档，与当前快照对比新增、删除、请求参数、响应和费用变化；不修改服务基线，无需 API Key。',
    inputSchema: fromJsonSchema(objectSchema(false)), annotations: { ...readOnly, openWorldHint: true } }, async () => {
    try { return result(compareSnapshots(options.snapshot, makeSnapshot(await (options.sourceFetcher ?? fetchSources)()))); }
    catch { return result({ error: '获取官方文档失败，当前文档基线未变更。可稍后重试或使用本地快照对比。' }, true); }
  });
  for (const [name, uri, value] of [
    ['api-version', 'seerfar://api/version', info],
    ['api-catalog', 'seerfar://api/catalog', options.snapshot.sources.config.endpoints.map((e) => ({ id: e.id, tool: toolName(e), method: e.method, path: e.path, label: zh(e.label) }))],
    ['api-updates', 'seerfar://api/updates', localize(options.snapshot.sources.updates)],
  ] as const) {
    server.registerResource(name, uri, { mimeType: 'application/json' }, async (url) => ({ contents: [{ uri: url.href, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }] }));
  }
}

export function createSeerfarServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: 'seerfar-api-mcp', version: '0.1.0' }, {
    instructions: '先用 seerfar_list_apis 和 seerfar_get_api_doc 查看接口。业务工具每次传入 API Key；HTTP 也支持 X-Seerfar-Api-Key。接口可能扣积分，采集和创建分析任务会改变账号数据；按用户意图调用，不自动重试。',
  });
  registerApiTools(server, options);
  registerCatalogTools(server, options.snapshot);
  registerVersionTools(server, options);
  return server;
}
