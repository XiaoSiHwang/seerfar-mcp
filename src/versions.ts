import type { Endpoint, JsonObject, Parameter, Snapshot } from './types.js';
import { zh } from './types.js';
import { hash, stableJson } from './snapshots.js';
import { toolName } from './schema.js';

export function pricingFor(snapshot: Snapshot, endpoint: Endpoint) {
  return snapshot.sources.pricing.items.find((item) => zh(item.name) === zh(endpoint.label));
}

export function snapshotInfo(snapshot: Snapshot) {
  const overview = snapshot.sources.config.sections.find((s) => s.id === 'overview');
  return {
    snapshotId: snapshot.id, fetchedAt: snapshot.fetchedAt, contentHash: snapshot.contentHash,
    documentBadges: overview?.badges,
    latestUpdateDate: snapshot.sources.updates.entries.map((e) => e.date).sort().at(-1),
    endpointCount: snapshot.sources.config.endpoints.length, sourceUrls: snapshot.sourceUrls,
  };
}

function namedParams(params?: Parameter[]) {
  return Object.fromEntries((params ?? []).map((p) => [p.name, p]));
}

export function endpointParts(snapshot: Snapshot, e: Endpoint): JsonObject {
  return {
    request: { method: e.method, path: e.path, pathParams: namedParams(e.pathParams),
      queryParams: namedParams(e.queryParams), headerParams: namedParams(e.headerParams),
      bodyParams: namedParams(e.bodyParams), bodyExample: e.bodyExample ?? null },
    response: { fields: namedParams(e.responseFields), example: e.responseExample ?? null, errors: e.errorResponses ?? [] },
    documentation: e,
    pricing: pricingFor(snapshot, e) ?? null,
  };
}

export function manifest(snapshot: Snapshot) {
  return {
    schemaVersion: 1, ...snapshotInfo(snapshot),
    operations: snapshot.sources.config.endpoints.map((e) => ({ id: e.id, tool: toolName(e), method: e.method,
      path: e.path, label: zh(e.label), hashes: Object.fromEntries(Object.entries(endpointParts(snapshot, e)).map(([key, value]) => [key, hash(value)])) })),
  };
}

function fieldChanges(before: unknown, after: unknown, path = ''): { path: string; before: unknown; after: unknown }[] {
  if (stableJson(before) === stableJson(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const left = before as JsonObject;
    const right = after as JsonObject;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
      .flatMap((key) => fieldChanges(left[key], right[key], path ? `${path}.${key}` : key));
  }
  return [{ path, before: before ?? null, after: after ?? null }];
}

export function compareSnapshots(before: Snapshot, after: Snapshot) {
  const left = new Map(before.sources.config.endpoints.map((e) => [e.id, e]));
  const right = new Map(after.sources.config.endpoints.map((e) => [e.id, e]));
  const added = [...right.values()].filter((e) => !left.has(e.id)).map((e) => ({ id: e.id, method: e.method, path: e.path }));
  const removed = [...left.values()].filter((e) => !right.has(e.id)).map((e) => ({ id: e.id, method: e.method, path: e.path }));
  const changed = [...right.values()].flatMap((e) => {
    const old = left.get(e.id);
    if (!old) return [];
    const oldParts = endpointParts(before, old);
    const newParts = endpointParts(after, e);
    const categories = Object.keys(newParts).filter((key) => hash(oldParts[key]) !== hash(newParts[key]));
    if (!categories.length) return [];
    return [{ id: e.id, method: e.method, path: e.path, categories,
      fields: fieldChanges(oldParts, newParts).filter((f) => !f.path.startsWith('documentation.') || categories.length === 1) }];
  });
  const globalChanges = {
    baseUrl: before.sources.config.baseUrl !== after.sources.config.baseUrl,
    sections: hash(before.sources.config.sections) !== hash(after.sources.config.sections),
    updates: hash(before.sources.updates) !== hash(after.sources.updates),
    pricing: hash(before.sources.pricing) !== hash(after.sources.pricing),
    config: hash({ ...before.sources.config, endpoints: [] }) !== hash({ ...after.sources.config, endpoints: [] }),
  };
  return { from: snapshotInfo(before), to: snapshotInfo(after), hasChanges: before.contentHash !== after.contentHash,
    added, removed, changed, globalChanges };
}

export type ApiDiff = ReturnType<typeof compareSnapshots>;

export function diffMarkdown(diff: ApiDiff): string {
  const lines = ['# Seerfar API 版本差异', '', `- 基线：${diff.from.snapshotId}`, `- 对照：${diff.to.snapshotId}`,
    `- 结果：${diff.hasChanges ? '存在更新' : '无更新'}`,
    `- 新增 ${diff.added.length}；删除 ${diff.removed.length}；修改 ${diff.changed.length}`, '',
    `全局变化：${Object.entries(diff.globalChanges).filter(([, v]) => v).map(([k]) => k).join('、') || '无'}`, ''];
  for (const [label, items] of [['新增', diff.added], ['删除', diff.removed]] as const) {
    for (const item of items) lines.push(`- ${label}：\`${item.id}\` — ${item.method} \`${item.path}\``);
  }
  for (const item of diff.changed) {
    lines.push('', `## ${item.id}`, '', `变化类型：${item.categories.join('、')}`, '');
    for (const field of item.fields) lines.push(`- \`${field.path}\``);
  }
  return `${lines.join('\n')}\n`;
}
