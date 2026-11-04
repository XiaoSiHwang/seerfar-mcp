import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Snapshot, Sources } from './types.js';

// 编译后的路径是 dist/src；数据始终从包根目录读取，不依赖启动时工作目录。
export const ROOT = fileURLToPath(new URL(import.meta.url.includes('/dist/') ? '../..' : '..', import.meta.url));
export const SOURCE_URLS = {
  config: 'http://doc.seerfar.cn/api-docs.config.json',
  updates: 'http://doc.seerfar.cn/api-updates.json',
  pricing: 'http://doc.seerfar.cn/api-pricing.example.json',
};

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function validateSources(value: Sources): void {
  if (!value.config?.endpoints?.length || !value.config.baseUrl || !Array.isArray(value.config.sections)
    || !Array.isArray(value.updates?.entries) || !Array.isArray(value.pricing?.items)) {
    throw new Error('官方文档数据结构不完整，停止更新。');
  }
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const e of value.config.endpoints) {
    const route = `${e.method} ${e.path}`;
    if (!e.id || !/^[a-z0-9-]+$/.test(e.id) || ids.has(e.id) || routes.has(route)
      || !e.path.startsWith('/open-api/') || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method)) {
      throw new Error(`官方文档中存在无效或重复接口：${e.id}`);
    }
    ids.add(e.id);
    routes.add(route);
  }
}

export function makeSnapshot(sources: Sources, fetchedAt = new Date().toISOString()): Snapshot {
  validateSources(sources);
  const contentHash = hash(sources);
  return { schemaVersion: 1, id: `${fetchedAt.slice(0, 10)}-${contentHash.slice(0, 12)}`, fetchedAt,
    sourceUrls: SOURCE_URLS, contentHash, sources };
}

export async function loadSnapshot(id?: string, root = ROOT): Promise<Snapshot> {
  if (!id) id = JSON.parse(await readFile(`${root}/api/current.json`, 'utf8')).snapshotId as string;
  if (!/^\d{4}-\d{2}-\d{2}-[a-f0-9]{12}$/.test(id)) throw new Error('无效的文档快照 ID');
  const snapshot = JSON.parse(await readFile(`${root}/api/snapshots/${id}.json`, 'utf8')) as Snapshot;
  validateSources(snapshot.sources);
  if (snapshot.id !== id || hash(snapshot.sources) !== snapshot.contentHash) throw new Error('文档快照完整性校验失败');
  return snapshot;
}

export async function fetchSources(fetcher: typeof fetch = fetch): Promise<Sources> {
  const values = await Promise.all(Object.values(SOURCE_URLS).map(async (url) => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(30_000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error(`文档获取失败：${url} HTTP ${response.status}`);
    return response.json();
  }));
  const sources = Object.fromEntries(Object.keys(SOURCE_URLS).map((key, i) => [key, values[i]])) as unknown as Sources;
  validateSources(sources);
  return sources;
}
