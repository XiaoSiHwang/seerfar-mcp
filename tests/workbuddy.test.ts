import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ROOT } from '../src/snapshots.js';

const run = promisify(execFile);

type Manifest = {
  name: string;
  version: string;
  license?: string;
  mcpServers: string;
  userConfig: Record<string, { type: string; title: string; description: string; sensitive?: boolean; required?: boolean }>;
};

async function readManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(join(ROOT, '.codebuddy-plugin/plugin.json'), 'utf8')) as Manifest;
}

test('WorkBuddy 插件清单声明敏感 Key，并留空时回退到工具参数', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.name, 'seerfar-mcp');
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.equal(manifest.userConfig.api_key?.type, 'string');
  assert.equal(manifest.userConfig.api_key?.sensitive, true);
  // WorkBuddy 5.9.3 没有渲染 userConfig 的界面，必填会让插件直接启动失败，因此改为可选。
  assert.equal(manifest.userConfig.api_key?.required, false);
  assert.ok(manifest.userConfig.api_key?.title.includes('Seerfar'));
});

test('插件通过 PLUGIN_OPT 注入 Key，未配置时不会中断 MCP 启动', async () => {
  const mcp = JSON.parse(await readFile(join(ROOT, '.mcp.json'), 'utf8')) as {
    mcpServers: Record<string, { type: string; command: string; args: string[]; cwd: string; env: Record<string, string> }>;
  };
  const server = mcp.mcpServers.seerfar!;
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'node');
  assert.equal(server.cwd, '${CODEBUDDY_PLUGIN_ROOT}');
  assert.deepEqual(server.args, ['${CODEBUDDY_PLUGIN_ROOT}/dist/src/index.js']);
  // PLUGIN_OPT 缺失时保持原样，服务端会识别成“未配置”；user_config 缺失则会让 WorkBuddy 直接启动失败。
  assert.equal(server.env.SEERFAR_API_KEY, '${PLUGIN_OPT:api_key}');
});

async function workbuddyHome(installedPlugins?: string[]): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'workbuddy-home-'));
  if (installedPlugins) {
    await mkdir(join(home, 'plugins'), { recursive: true });
    await writeFile(join(home, 'plugins/installed_plugins.json'),
      JSON.stringify({ version: 2, plugins: Object.fromEntries(installedPlugins.map((id) => [id, []])) }));
  }
  return home;
}

async function keyScript(home: string, args: string[]): Promise<string> {
  const { stdout } = await run(process.execPath, [join(ROOT, 'scripts/workbuddy-key.mjs'), ...args], {
    cwd: ROOT, env: { ...process.env, WORKBUDDY_HOME: home },
  });
  return stdout;
}

// execFile 失败时 stderr 才是脚本的中文提示，error.message 只有命令行。
async function keyScriptError(home: string, args: string[]): Promise<string> {
  try {
    await keyScript(home, args);
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error);
  }
  assert.fail(`预期脚本失败：${args.join(' ')}`);
}

const SAMPLE_KEY = 'sk-test-1234567890';

test('npm run workbuddy:key 写入本机凭据，支持查看掩码与清除', async () => {
  const home = await workbuddyHome();
  await keyScript(home, [SAMPLE_KEY]);
  const file = join(home, 'credentials.json');
  const saved = JSON.parse(await readFile(file, 'utf8')) as { pluginSecrets: Record<string, { api_key: string }> };
  assert.equal(saved.pluginSecrets['seerfar-mcp@seerfar-marketplace']?.api_key, SAMPLE_KEY);
  assert.equal((await stat(file)).mode & 0o777, 0o600);

  const shown = await keyScript(home, ['--show']);
  assert.match(shown, /seerfar-mcp@seerfar-marketplace：sk-t\*+7890/);
  assert.ok(!shown.includes(SAMPLE_KEY));

  await keyScript(home, ['--clear']);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).pluginSecrets, {});
  assert.match(await keyScript(home, ['--show']), /未配置/);
});

test('npm run workbuddy:key 优先跟随已安装插件登记的市场名', async () => {
  const home = await workbuddyHome(['seerfar-mcp@my-market', 'other-plugin@my-market']);
  await keyScript(home, ['sk-market-key']);
  const saved = JSON.parse(await readFile(join(home, 'credentials.json'), 'utf8')) as { pluginSecrets: Record<string, unknown> };
  assert.deepEqual(Object.keys(saved.pluginSecrets), ['seerfar-mcp@my-market']);

  const explicit = await workbuddyHome();
  await keyScript(explicit, ['sk-explicit', '--marketplace', 'codebuddy-plugins-official']);
  const explicitSaved = JSON.parse(await readFile(join(explicit, 'credentials.json'), 'utf8')) as { pluginSecrets: Record<string, unknown> };
  assert.deepEqual(Object.keys(explicitSaved.pluginSecrets), ['seerfar-mcp@codebuddy-plugins-official']);
});

test('npm run workbuddy:key 拒绝空白字符与未替换的占位符', async () => {
  const home = await workbuddyHome();
  assert.match(await keyScriptError(home, ['sk-bad key']), /不能包含空白字符/);
  assert.match(await keyScriptError(home, ['${apikey_binding}']), /不能包含空白字符/);
});
