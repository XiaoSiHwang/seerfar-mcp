import { loadSnapshot } from '../src/snapshots.js';
import { compareSnapshots, diffMarkdown } from '../src/versions.js';

async function main(): Promise<void> {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) throw new Error('用法：npm run api:diff -- <旧快照ID> <新快照ID>');
  const [before, after] = await Promise.all([loadSnapshot(from), loadSnapshot(to)]);
  console.log(diffMarkdown(compareSnapshots(before, after)));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : '对比失败'); process.exitCode = 1; });
