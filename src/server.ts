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
  envKey?: string;
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

function toolAnnotations(endpoint: { id: string }) {
  const writes = /product-collect$|review-analyse-task-add$/.test(endpoint.id);
  return { readOnlyHint: !writes, destructiveHint: false, idempotentHint: !writes, openWorldHint: true };
}

function registerApiTools(server: McpServer, options: ServerOptions): void {
  const envKeyConfigured = Boolean(options.envKey);
  for (const endpoint of options.snapshot.sources.config.endpoints) {
    const price = pricingFor(options.snapshot, endpoint);
    const keyNote = envKeyConfigured
      ? 'Key：已由 WorkBuddy 插件设置提供，通常可省略 apiKey。'
      : 'Key：需要 apiKey 参数，或先在 WorkBuddy 插件设置中配置。';
    server.registerTool(toolName(endpoint), {
      title: zh(endpoint.label),
      description: `${zh(endpoint.description)}\n${endpoint.method} ${endpoint.path}\n费用：${zh(price?.credits ?? endpoint.credits)}；频率：${zh(price?.callCount)}。失败不会自动重试。\n${keyNote}`,
      inputSchema: fromJsonSchema<ApiArguments>(inputSchema(endpoint, options.headerKeyAllowed, envKeyConfigured)),
      annotations: toolAnnotations(endpoint),
    }, async (args, context) => {
      const response = await options.client.execute(endpoint, args, options.headerKey, context.mcpReq.signal);
      return result(response, response.isError);
    });
  }
}

function registerCatalogTools(server: McpServer, snapshot: Snapshot, envKeyConfigured: boolean, headerKeyAllowed: boolean): void {
  const filterSchema: JsonSchema = { ...objectSchema(false), properties: { keyword: { type: 'string', description: '按 ID、名称或路径筛选' } } };
  server.registerTool('seerfar_list_apis', { title: '列出 Seerfar 接口', description: '列出当前版本支持的全部 Seerfar API 及工具名、费用和频率，无需 API Key。',
    inputSchema: fromJsonSchema<{ keyword?: string }>(filterSchema), annotations: readOnly }, async ({ keyword }) => {
    const endpoints = snapshot.sources.config.endpoints.filter((e) => `${e.id} ${e.path} ${zh(e.label)}`.toLowerCase().includes(keyword?.toLowerCase() ?? ''));
    return result(endpoints.map((e) => ({ id: e.id, tool: toolName(e), label: zh(e.label), method: e.method, path: e.path, pricing: localize(pricingFor(snapshot, e)) })));
  });
  server.registerTool('seerfar_get_api_doc', { title: '查看 Seerfar 接口文档', description: '查询接口的完整请求参数、必填条件、响应字段、示例、费用及错误说明，无需 API Key。',
    inputSchema: fromJsonSchema<{ id: string }>({ ...objectSchema(false), properties: { id: { type: 'string' } }, required: ['id'] }), annotations: readOnly }, async ({ id }) => {
    const endpoint = snapshot.sources.config.endpoints.find((e) => e.id === id || toolName(e) === id);
    return endpoint ? result({ snapshotId: snapshot.id, endpoint: localize(endpoint), pricing: localize(pricingFor(snapshot, endpoint)), inputSchema: inputSchema(endpoint, headerKeyAllowed, envKeyConfigured) })
      : result({ error: '接口不存在，请先调用 seerfar_list_apis。' }, true);
  });
}

function registerVersionTools(server: McpServer, options: ServerOptions): void {
  const info = { ...snapshotInfo(options.snapshot), mcpVersion: '0.2.0', apiBaseUrl: options.client.baseUrl, apiKeyConfigured: Boolean(options.envKey) };
  server.registerTool('seerfar_api_version', { title: '查看 Seerfar MCP 版本', description: '查看 MCP 版本、当前 API 文档快照、内容哈希、上游更新日期以及插件 Key 是否已配置。',
    inputSchema: fromJsonSchema(objectSchema(false)), annotations: readOnly }, async () => result(info));
  server.registerTool('seerfar_check_api_updates', { title: '检查 Seerfar 接口更新', description: '在线读取官方文档，与当前快照对比新增、删除、请求参数、响应和费用变化；不修改服务基线，无需 API Key。',
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
  const envKeyConfigured = Boolean(options.envKey);
  const instructions = envKeyConfigured
    ? '先用 seerfar_list_apis 和 seerfar_get_api_doc 查看接口。API Key 已由 WorkBuddy 插件设置提供，业务工具调用时通常无需再传 apiKey；用户显式提供时以用户为准。不要询问、回显或记录已配置的 Key。接口可能扣积分，采集和创建分析任务会改变账号数据；按用户意图调用，不自动重试。'
    : '先用 seerfar_list_apis 和 seerfar_get_api_doc 查看接口。业务工具需要 API Key：优先请用户在 WorkBuddy 插件设置中填写，或在本次调用传入 apiKey；HTTP 也支持 X-Seerfar-Api-Key。不要回显 Key。接口可能扣积分，采集和创建分析任务会改变账号数据；按用户意图调用，不自动重试。';
  const server = new McpServer({ name: 'seerfar-api-mcp', version: '0.2.0' }, { instructions });
  registerApiTools(server, options);
  registerCatalogTools(server, options.snapshot, envKeyConfigured, Boolean(options.headerKeyAllowed));
  registerVersionTools(server, options);
  return server;
}
