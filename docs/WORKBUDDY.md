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
      "description": "在 Seerfar 控制台获取。保存后由 WorkBuddy 注入 MCP 服务，不会写入插件文件。",
      "sensitive": true,
      "required": true
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
        "SEERFAR_API_KEY": "${user_config.api_key}"
      }
    }
  }
}
```

用户在 WorkBuddy 的插件设置/配置面板填写 Key 后：

1. WorkBuddy 把敏感值存进系统凭据存储（本机为 `credentials.json`，权限 0600）。
2. 启动 MCP 服务时替换 `${user_config.api_key}`。
3. 服务端按 `工具参数 apiKey > HTTP X-Seerfar-Api-Key > SEERFAR_API_KEY` 的优先级取 Key。
4. 工具参数不再强制必填；显式传入时仍以本次参数为准。

服务端不落盘、不打印 Key；上游响应中如果回显 Key，会替换为 `[REDACTED]`。

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

1. 打开「设置 → 插件 → 市场」。
2. 选择「添加市场」，添加本地目录 `release/seerfar-marketplace`。
3. 安装 `seerfar-mcp`。
4. 在插件配置里填写 Seerfar API Key。
5. 重启或重新加载插件，确认工具列表出现 `seerfar_list_apis`、`seerfar_quota` 等。

> `release/` 已在 `.gitignore` 中，不会误提交。

## 三、官方市场上架

WorkBuddy 内置的官方市场是 `codebuddy-plugins-official`，公开仓库：

**https://cnb.cool/CodeBuddy/marketplace**

仓库的 `.gitignore` 会忽略 `node_modules/`，所以官方 PR 推荐使用 npm 版：

1. 把 `package.json` 的 `"private": true` 改为 `false`，补齐 `license`，然后 `npm publish --access public`。
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

- [ ] 提交目录中没有真实 Key、`.env`、测试脚本输出（官方 PR 用 npm 版）
- [ ] `npm run check` 全部通过
- [ ] `plugin.json` 与 `marketplace.json` 的 `version` 一致
- [ ] README 说明 Node.js >= 22、计费接口和写操作
- [ ] 补充 `LICENSE`，并在 `.codebuddy-plugin/plugin.json` 增加 `license` 字段
- [ ] 删除本机 `~/.workbuddy/plugins/cache` 对应目录后重新安装验证
