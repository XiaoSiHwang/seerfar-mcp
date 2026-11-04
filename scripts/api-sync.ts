import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ROOT, fetchSources, loadSnapshot, makeSnapshot } from '../src/snapshots.js';
import { compareSnapshots, diffMarkdown, manifest, pricingFor } from '../src/versions.js';
import { inputSchema, toolName } from '../src/schema.js';
import { zh } from '../src/types.js';
import type { Snapshot, Sources } from '../src/types.js';
import { Ajv } from 'ajv';

const { values } = parseArgs({ options: { check: { type: 'boolean' }, 'from-dir': { type: 'string' }, 'report-dir': { type: 'string' } } });

async function readSources(directory: string): Promise<Sources> {
  const entries = await Promise.all(['config', 'updates', 'pricing'].map(async (key) =>
    [key, JSON.parse(await readFile(`${directory}/${key}.json`, 'utf8'))]));
  return Object.fromEntries(entries) as unknown as Sources;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

async function saveSnapshot(snapshot: Snapshot): Promise<Snapshot> {
  try { await writeFile(`${ROOT}/api/snapshots/${snapshot.id}.json`, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = await loadSnapshot(snapshot.id);
    if (existing.contentHash !== snapshot.contentHash) throw new Error('快照 ID 冲突，停止同步。');
    return existing;
  }
  return snapshot;
}

async function writeGeneratedFiles(snapshot: Snapshot): Promise<void> {
  await writeJson(`${ROOT}/api/catalog.json`, snapshot.sources.config.endpoints.map((e) => ({ id: e.id, name: toolName(e), inputSchema: inputSchema(e) })));
  await writeFile(`${ROOT}/docs/API_COVERAGE.md`, coverage(snapshot));
}

function coverage(snapshot: Snapshot): string {
  const lines = ['# Seerfar API 覆盖清单', '', `文档快照：${snapshot.id}；共 ${snapshot.sources.config.endpoints.length} 个接口。`, '',
    '工具名由文档接口 ID 稳定生成；请求参数及响应字段保存在快照中，可通过 seerfar_get_api_doc 查询。', '',
    '| MCP 工具 | 方法 | 路径 | 接口 | 费用 | 频率 |', '| --- | --- | --- | --- | --- | --- |'];
  for (const e of snapshot.sources.config.endpoints) {
    const price = pricingFor(snapshot, e);
    lines.push(`| \`${toolName(e)}\` | ${e.method} | \`${e.path}\` | ${zh(e.label)} | ${zh(price?.credits)} | ${zh(price?.callCount)} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function sync(): Promise<void> {
  const sources = values['from-dir'] ? await readSources(values['from-dir']) : await fetchSources();
  const next = makeSnapshot(sources);
  const ajv = new Ajv({ strict: false });
  for (const endpoint of sources.config.endpoints) ajv.compile(inputSchema(endpoint));
  let previous: Snapshot | undefined;
  try { previous = await loadSnapshot(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const diff = previous ? compareSnapshots(previous, next) : undefined;
  if (values.check && !previous) throw new Error('无本地基线，请先执行 npm run api:sync');
  if (diff) {
    const reportDir = values['report-dir'] ?? `${ROOT}/reports`;
    await mkdir(reportDir, { recursive: true });
    await writeJson(`${reportDir}/api-diff.json`, diff);
    await writeFile(`${reportDir}/api-diff.md`, diffMarkdown(diff));
    console.log(diffMarkdown(diff));
  }
  if (values.check) { process.exitCode = diff?.hasChanges ? 2 : 0; return; }
  if (previous && !diff?.hasChanges) { await writeGeneratedFiles(previous); return; }
  await mkdir(`${ROOT}/api/snapshots`, { recursive: true });
  await mkdir(`${ROOT}/docs/changes`, { recursive: true });
  const saved = await saveSnapshot(next);
  await writeGeneratedFiles(saved);
  if (diff) await writeFile(`${ROOT}/docs/changes/${previous!.id}--${next.id}.md`, diffMarkdown(diff));
  await writeJson(`${ROOT}/api/current.json`, manifest(saved));
  console.log(`已保存文档快照 ${next.id}，覆盖 ${sources.config.endpoints.length} 个接口。`);
}

sync().catch((error: unknown) => { console.error(error instanceof Error ? error.message : '同步失败'); process.exitCode = 1; });
