import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareSnapshots, diffMarkdown } from '../src/versions.js';
import { hash, loadSnapshot, makeSnapshot, ROOT } from '../src/snapshots.js';

const baseline = await loadSnapshot();

test('版本用内容哈希区分，抓取时间和 JSON 键顺序不产生假更新', () => {
  const next = makeSnapshot(structuredClone(baseline.sources), '2026-10-26T00:00:00Z');
  assert.equal(compareSnapshots(baseline, next).hasChanges, false);
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
});

test('区分新增、删除、参数、响应、费用、说明和更新记录变化', () => {
  const sources = structuredClone(baseline.sources);
  sources.config.endpoints.pop();
  sources.config.endpoints.push({ ...sources.config.endpoints[0]!, id: 'new-endpoint', path: '/open-api/new' });
  sources.config.endpoints[1]!.bodyParams![0]!.required = false;
  sources.config.endpoints[2]!.responseFields![0]!.docType = 'string';
  sources.pricing.items[3]!.credits = '999 credits';
  sources.config.endpoints[4]!.description = '变更后的说明';
  sources.updates.entries.unshift({ date: '2026-10-26', changes: [] });
  const diff = compareSnapshots(baseline, makeSnapshot(sources));
  assert.equal(diff.hasChanges, true); assert.equal(diff.added.length, 1); assert.equal(diff.removed.length, 1);
  assert.ok(diff.changed.find((e) => e.id === sources.config.endpoints[1]!.id)?.fields.some((f) => f.path === 'request.bodyParams.id.required'));
  assert.ok(diff.changed.some((e) => e.categories.includes('response')));
  assert.ok(diff.changed.some((e) => e.categories.includes('pricing')));
  assert.ok(diff.changed.some((e) => e.categories.includes('documentation')));
  assert.equal(diff.globalChanges.updates, true);
  assert.ok(diffMarkdown(diff).includes('存在更新'));
});

test('不完整或重复的上游接口文档阻止建立新快照', () => {
  const sources = structuredClone(baseline.sources); sources.config.endpoints = [];
  assert.throws(() => makeSnapshot(sources));
  sources.config.endpoints = [baseline.sources.config.endpoints[0]!, baseline.sources.config.endpoints[0]!];
  assert.throws(() => makeSnapshot(sources));
});

test('命令行检查用退出码 2 表示有更新，且不修改当前基线和历史快照', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seerfar-version-test-'));
  const sources = structuredClone(baseline.sources); sources.config.endpoints[0]!.description = '测试新说明';
  await Promise.all(Object.entries(sources).map(([key, value]) => writeFile(join(dir, `${key}.json`), JSON.stringify(value))));
  const oldManifest = await readFile(`${ROOT}/api/current.json`, 'utf8');
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/api-sync.ts', '--check', '--from-dir', dir, '--report-dir', join(dir, 'reports')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.ok(result.stdout.includes('存在更新'));
  assert.equal(await readFile(`${ROOT}/api/current.json`, 'utf8'), oldManifest);
  assert.equal((await loadSnapshot(baseline.id)).contentHash, baseline.contentHash);
});
