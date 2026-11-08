#!/usr/bin/env node
/**
 * 把 Seerfar API Key 写入 WorkBuddy 本机凭据，供插件在启动 MCP 时注入 SEERFAR_API_KEY。
 *
 *   npm run workbuddy:key -- sk-xxxx
 *   npm run workbuddy:key -- --clear
 *   npm run workbuddy:key -- --show
 *
 * 写入位置：~/.workbuddy/credentials.json
 *   { "pluginSecrets": { "seerfar-mcp@<marketplace>": { "api_key": "sk-..." } } }
 *
 * WorkBuddy 5.9.3 的插件管理界面没有渲染 userConfig 表单，凭据只能写进这个文件。
 * 插件 ID 形如 `<plugin>@<marketplace>`；脚本会优先从 installed_plugins.json 里找出
 * 本机已安装的 seerfar-mcp，也支持用 --marketplace 手动指定。
 */
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = process.env.WORKBUDDY_HOME?.trim() || join(homedir(), '.workbuddy');
const CREDENTIALS = join(HOME, 'credentials.json');
const INSTALLED = join(HOME, 'plugins', 'installed_plugins.json');
const PLUGIN_NAME = 'seerfar-mcp';
const DEFAULT_MARKETPLACE = 'seerfar-marketplace';

function parseArgs(argv) {
  const options = { clear: false, show: false, marketplace: undefined, key: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--clear') options.clear = true;
    else if (arg === '--show') options.show = true;
    else if (arg === '--marketplace') options.marketplace = argv[++index];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (!arg.startsWith('-')) options.key = arg;
  }
  return options;
}

// 已安装插件里可能登记了多个市场来源，逐个写入，避免猜错市场名。
async function targetPluginIds(marketplace) {
  if (marketplace) return [`${PLUGIN_NAME}@${marketplace}`];
  try {
    const registry = JSON.parse(await readFile(INSTALLED, 'utf8'));
    const ids = Object.keys(registry?.plugins ?? {}).filter((id) => id.startsWith(`${PLUGIN_NAME}@`));
    if (ids.length > 0) return ids;
  } catch { /* 未安装插件时退回默认市场名 */ }
  return [`${PLUGIN_NAME}@${DEFAULT_MARKETPLACE}`];
}

async function readCredentials() {
  try {
    const parsed = JSON.parse(await readFile(CREDENTIALS, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('credentials.json 根节点必须是对象');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error(`credentials.json 不是合法 JSON，请先备份并修复：${CREDENTIALS}`);
    throw error;
  }
}

async function writeCredentials(value) {
  await mkdir(HOME, { recursive: true });
  const temporary = `${CREDENTIALS}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await chmod(temporary, 0o600);
  await rename(temporary, CREDENTIALS);
}

const mask = (key) => `${key.slice(0, 4)}${'*'.repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：npm run workbuddy:key -- <API Key> [--marketplace 市场名]\n      npm run workbuddy:key -- --clear\n      npm run workbuddy:key -- --show');
    return;
  }
  const ids = await targetPluginIds(options.marketplace);
  const credentials = await readCredentials();
  const secrets = { ...(credentials.pluginSecrets ?? {}) };

  if (options.show) {
    for (const id of ids) {
      const current = secrets[id]?.api_key;
      console.log(current ? `${id}：${mask(current)}（${CREDENTIALS}）` : `${id}：未配置（${CREDENTIALS}）`);
    }
    return;
  }
  if (options.clear) {
    for (const id of ids) {
      if (!secrets[id]) { console.log(`${id}：本来就没有配置`); continue; }
      delete secrets[id];
      console.log(`${id}：已清除`);
    }
    await writeCredentials({ ...credentials, pluginSecrets: secrets });
    return;
  }

  const key = options.key?.trim();
  if (!key) throw new Error('缺少 API Key。用法：npm run workbuddy:key -- <API Key>');
  if (/\s/.test(key) || key.includes('${')) throw new Error('API Key 不能包含空白字符或未替换的占位符。');
  for (const id of ids) secrets[id] = { ...secrets[id], api_key: key };
  await writeCredentials({ ...credentials, pluginSecrets: secrets });
  console.log(`已写入 ${CREDENTIALS}：${ids.join('、')}`);
  console.log('重启 WorkBuddy 或重新加载插件后生效；用 npm run workbuddy:key -- --show 可核对。');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : '写入失败'); process.exitCode = 1; });
