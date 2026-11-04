#!/usr/bin/env node
/**
 * 生成可直接添加到 WorkBuddy / CodeBuddy 市场的自包含插件目录。
 *
 *   npm run package:workbuddy
 *   -> release/seerfar-marketplace/
 *      ├── .codebuddy-plugin/marketplace.json
 *      └── plugins/seerfar-mcp/
 *          ├── .codebuddy-plugin/plugin.json
 *          ├── .mcp.json
 *          ├── dist/
 *          ├── node_modules/   （仅生产依赖）
 *          └── ...
 *
 * 本地测试：WorkBuddy「设置 → 插件 → 市场 → 添加市场」选择 release/seerfar-marketplace。
 * 官方上架：把 plugins/seerfar-mcp 复制到 cnb.cool/CodeBuddy/marketplace/plugins/，
 *           并在官方 marketplace.json 增加条目。
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmMode = process.argv.includes('--npm');
const output = join(root, 'release', npmMode ? 'seerfar-marketplace-npm' : 'seerfar-marketplace');
const pluginOutput = join(output, 'plugins', 'seerfar-mcp');

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

run('npm', ['run', 'build']);

await rm(join(root, 'release', 'seerfar-mcp'), { recursive: true, force: true });
await rm(output, { recursive: true, force: true });
await mkdir(join(output, '.codebuddy-plugin'), { recursive: true });
await mkdir(pluginOutput, { recursive: true });

const manifest = JSON.parse(await readFile(join(root, '.codebuddy-plugin/plugin.json'), 'utf8'));
const marketplace = {
  name: 'seerfar-marketplace',
  owner: { name: manifest.author?.name ?? 'Seerfar' },
  plugins: [{
    name: manifest.name,
    description: manifest.description,
    description_en: 'Query Ozon and Wildberries shops, competitors, categories, keywords, rankings, and reviews through Seerfar Open API.',
    version: manifest.version,
    source: `./plugins/${manifest.name}`,
    ...(manifest.author ? { author: manifest.author } : {}),
    ...(manifest.homepage ? { homepage: manifest.homepage } : {}),
    ...(manifest.repository ? { repository: manifest.repository } : {}),
    ...(manifest.keywords ? { keywords: manifest.keywords } : {}),
    ...(manifest.category ? { category: manifest.category } : {}),
  }],
};
await writeFile(join(output, '.codebuddy-plugin/marketplace.json'), `${JSON.stringify(marketplace, null, 2)}\n`);

const required = ['.codebuddy-plugin', 'README.md', 'CHANGELOG.md'];
for (const item of required) {
  await cp(join(root, item), join(pluginOutput, item), { recursive: true });
}
for (const item of ['LICENSE', 'LICENSE.md']) {
  if (existsSync(join(root, item))) await cp(join(root, item), join(pluginOutput, item));
}

if (npmMode) {
  // 官方市场仓库会忽略 node_modules；这种模式通过 npm 包提供运行时代码。
  const mcp = {
    mcpServers: {
      seerfar: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', `seerfar-api-mcp@${manifest.version}`],
        env: { SEERFAR_API_KEY: '${user_config.api_key}' },
      },
    },
  };
  await writeFile(join(pluginOutput, '.mcp.json'), `${JSON.stringify(mcp, null, 2)}\n`);
  console.log(`\nWorkBuddy npm 市场已生成：${output}`);
  console.log('使用前先发布 npm 包；官方上架时把这个目录复制到 cnb.cool/CodeBuddy/marketplace/plugins/。');
} else {
  for (const item of ['.mcp.json', 'package.json', 'package-lock.json', 'dist', 'api']) {
    await cp(join(root, item), join(pluginOutput, item), { recursive: true });
  }
  // 只安装生产依赖，确保插件被 WorkBuddy 复制到 cache 后仍可独立运行。
  run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], pluginOutput);
  const size = await stat(join(pluginOutput, 'node_modules'));
  if (!size.isDirectory()) throw new Error('生产依赖安装失败');
  console.log(`\nWorkBuddy 本地市场已生成：${output}`);
  console.log('本地测试：WorkBuddy → 设置 → 插件 → 市场 → 添加市场 → 选择 release/seerfar-marketplace');
  console.log('官方上架：把 plugins/seerfar-mcp 复制到 cnb.cool/CodeBuddy/marketplace/plugins/，并在官方 marketplace.json 增加条目。');
}
