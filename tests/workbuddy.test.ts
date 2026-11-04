import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../src/snapshots.js';

test('WorkBuddy 插件清单声明敏感 Key，并注入 MCP 进程环境', async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, '.codebuddy-plugin/plugin.json'), 'utf8')) as {
    name: string;
    version: string;
    mcpServers: string;
    userConfig: Record<string, { type: string; title: string; description: string; sensitive?: boolean; required?: boolean }>;
  };
  assert.equal(manifest.name, 'seerfar-mcp');
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.equal(manifest.userConfig.api_key?.type, 'string');
  assert.equal(manifest.userConfig.api_key?.sensitive, true);
  assert.equal(manifest.userConfig.api_key?.required, true);
  assert.ok(manifest.userConfig.api_key?.title.includes('Seerfar'));

  const mcp = JSON.parse(await readFile(join(ROOT, '.mcp.json'), 'utf8')) as {
    mcpServers: Record<string, { type: string; command: string; args: string[]; cwd: string; env: Record<string, string> }>;
  };
  const server = mcp.mcpServers.seerfar!;
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'node');
  assert.equal(server.cwd, '${CODEBUDDY_PLUGIN_ROOT}');
  assert.deepEqual(server.args, ['${CODEBUDDY_PLUGIN_ROOT}/dist/src/index.js']);
  assert.equal(server.env.SEERFAR_API_KEY, '${user_config.api_key}');
});
