# WorkBuddy / CodeBuddy 插件发布指南

本项目现在同时支持两种使用方式：

- **普通 MCP 客户端**：stdio / HTTP，API Key 由工具参数或 HTTP 请求头传入。
- **WorkBuddy 插件**：用户在插件设置里填写 Seerfar API Key，WorkBuddy 以 `SEERFAR_API_KEY` 环境变量注入 MCP 服务，业务工具不需要再传 `apiKey`。

## 一、插件里怎么配置 API Key

插件清单 `.codebuddy-plugin/plugin.json` 声明了一个敏感配置项：

```json
{
  "userConfig": {
    "api_key": {
      "type": "string",
      "title": "Seerfar API Key",
      "description": "在 Seerfar 控制台获取。可用 `npm run workbuddy:key` 写入本机凭据，保存后由 WorkBuddy 注入 MCP 服务，不会写入插件文件。留空时业务工具会改为要求 apiKey 参数。",
      "sensitive": true,
      "required": false
    }
  }
}
```

`.mcp.json` 把它注入服务进程：

```json
{
  "mcpServers": {
    "seerfar": {
      "type": "stdio",
      "command": "node",
      "args": ["${CODEBUDDY_PLUGIN_ROOT}/dist/src/index.js"],
      "cwd": "${CODEBUDDY_PLUGIN_ROOT}",
      "env": {
        "SEERFAR_API_KEY": "${PLUGIN_OPT:api_key}"
      }
    }
  }
}
```

> 为什么不用 `${user_config.api_key}`：WorkBuddy 5.9.3（当前 macOS 版）的插件管理界面没有渲染 `userConfig` 表单，
> 而 `user_config` 变量缺失会直接抛 `No value found for user_config.api_key` 中断 MCP 启动。
> `${PLUGIN_OPT:api_key}` 缺失时保持字面量，服务端会识别为“未配置”，插件照常启动。

### 1. 写入 Key（推荐）

```sh
npm run workbuddy:key -- sk-你的Key          # 写入 ~/.workbuddy/credentials.json（权限 0600）
npm run workbuddy:key -- --show              # 查看掩码，确认写到哪个插件 ID
npm run workbuddy:key -- --clear             # 清除
```

脚本会自动跟随 `~/.workbuddy/plugins/installed_plugins.json` 里已安装的 `seerfar-mcp@<市场名>`；
也可以手动指定：`--marketplace codebuddy-plugins-official`。写入后重启 WorkBuddy 或重新加载插件。

配置生效后：

1. WorkBuddy 把敏感值存进本机凭据（`credentials.json`，权限 0600）。
2. 启动 MCP 服务时替换 `${PLUGIN_OPT:api_key}`。
3. 服务端按 `工具参数 apiKey > HTTP X-Seerfar-Api-Key > SEERFAR_API_KEY` 的优先级取 Key。
4. 工具参数不再强制必填；显式传入时仍以本次参数为准。

服务端不落盘、不打印 Key；上游响应中如果回显 Key，会替换为 `[REDACTED]`。

### 2. 不写凭据时

插件仍可安装和启动，但 `seerfar_*` 业务工具会要求本次调用传入 `apiKey` 参数
（`seerfar_list_apis`、`seerfar_get_api_doc`、`seerfar_api_version` 等查询类工具不受影响）。
另一种做法是绕开插件，把服务直接登记到「连接器 → 自定义连接器」，在 `env` 里写 `SEERFAR_API_KEY`。

## 二、本地生成并测试插件

```sh
npm ci
npm run check
npm run package:workbuddy        # 自包含版，适合本地/内网
npm run package:workbuddy:npm    # npm 版，适合提 PR 到官方市场
```

- `release/seerfar-marketplace/`：自包含版，`plugins/seerfar-mcp/` 内含 `dist/`、`api/` 文档快照、生产依赖、插件清单和 `.mcp.json`。
- `release/seerfar-marketplace-npm/`：只含插件清单和 `.mcp.json`，通过 `npx -y seerfar-api-mcp@0.2.0` 启动。官方市场仓库会忽略 `node_modules`，提 PR 用这个版本。

在 WorkBuddy 中：

1. 打开侧栏「技能」页，切到「套件」标签（英文界面为 Plugins）。
2. 点右上角「+」→「添加市场」，填本地目录 `release/seerfar-marketplace`（或用 `/plugin marketplace add`）。
3. 安装 `seerfar-mcp`。
4. 运行 `npm run workbuddy:key -- <你的 Seerfar API Key>` 写入 Key。
5. 重启 WorkBuddy 或重新加载插件，确认工具列表出现 `seerfar_list_apis`、`seerfar_quota` 等。

> `release/` 已在 `.gitignore` 中，不会误提交。

## 三、官方市场上架

WorkBuddy 内置的官方市场是 `codebuddy-plugins-official`，公开仓库：

**https://cnb.cool/codebuddy/marketplace**

仓库的 `.gitignore` 会忽略 `node_modules/`，所以官方 PR 推荐使用 npm 版：

1. 确认 `package.json` 的 `private` 已移除、`license` 为 MIT，然后 `npm publish --access public`。
2. 运行 `npm run package:workbuddy:npm`。
3. Fork 上述仓库，把 `release/seerfar-marketplace-npm/plugins/seerfar-mcp/` 复制为官方仓库中的 `plugins/seerfar-mcp/`。
4. 在 `.codebuddy-plugin/marketplace.json` 的 `plugins` 数组中加入：

```json
{
  "name": "seerfar-mcp",
  "description": "用自然语言查询 Ozon / Wildberries 的店铺、竞品、类目、关键词、榜单与评论数据。",
  "description_en": "Query Ozon and Wildberries shops, competitors, categories, keywords, rankings, and reviews in natural language.",
  "version": "0.2.0",
  "source": "./plugins/seerfar-mcp",
  "author": {
    "name": "XiaoSiHwang",
    "url": "https://github.com/XiaoSiHwang"
  },
  "homepage": "https://github.com/XiaoSiHwang/seerfar-mcp",
  "repository": "https://github.com/XiaoSiHwang/seerfar-mcp",
  "keywords": ["seerfar", "ozon", "wildberries", "mcp", "电商数据"],
  "category": "电商数据"
}
```

5. 提交 PR 到 `main`。
6. 按官方要求补 README、许可证，并配合安全审查。

官方 README 的硬性要求：

- 完整的 `.codebuddy-plugin/plugin.json`
- 清晰的 README
- 通过基本安全审查

合并后官方市场同步，用户在 WorkBuddy 插件市场即可搜索、安装和更新。

## 四、审核关注点

本项目的 MCP 已按 WorkBuddy 的审核/审批模式做了以下处理：

- **敏感配置用 `userConfig`**：Key 不进工具参数、不进聊天记录、不写进插件文件。
- **工具注解**：只读查询标记 `readOnlyHint: true`、`idempotentHint: true`；采集和创建分析任务标记 `readOnlyHint: false`、`idempotentHint: false`；所有外部请求标记 `openWorldHint: true`，方便 WorkBuddy 的 AI 审批判断。
- **写操作明确**：`product-collect` 和 `review-analyse-task-add` 会在工具描述中标注会改变账号数据。
- **不自动重试**：失败、限流、超时都原样返回，避免重复扣费或重复写入。
- **固定上游**：只访问启动参数或 `SEERFAR_BASE_URL` 指定的地址，不跟随重定向。
- **Key 脱敏**：上游响应回显的 Key 会替换为 `[REDACTED]`。

上架前请确认：

- [x] 提交目录中没有真实 Key、`.env`、测试脚本输出（官方 PR 用 npm 版）
- [x] `npm run check` 全部通过
- [x] `plugin.json` 与 `marketplace.json` 的 `version` 一致
- [x] README 说明 Node.js >= 22、计费接口和写操作
- [x] 补充 `LICENSE`（MIT），并在 `.codebuddy-plugin/plugin.json` 与 `package.json` 增加 `license` 字段
- [ ] 删除本机 `~/.workbuddy/plugins/cache` 对应目录后重新安装验证
