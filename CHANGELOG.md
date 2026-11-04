# 变更记录

## 0.2.0 — 2026-11-05

- 增加 WorkBuddy / CodeBuddy 插件清单 `.codebuddy-plugin/plugin.json` 与 `.mcp.json`。
- 支持在 WorkBuddy 插件设置中填写 Seerfar API Key，通过 `userConfig.api_key`（敏感项）注入 `SEERFAR_API_KEY`；服务端按工具参数 > HTTP 请求头 > 插件环境变量的优先级取 Key。
- 插件 Key 已配置时，业务工具 Schema 不再暴露 `apiKey`，避免 Key 进入对话记录；普通 MCP 客户端仍支持显式参数。
- 完善工具注解：只读查询与写操作分别标记 `readOnlyHint`、`idempotentHint`、`openWorldHint`，适配 WorkBuddy 的审核/审批模式。
- 新增 `npm run package:workbuddy`（自包含）与 `npm run package:workbuddy:npm`（官方市场上架用），生成可直接安装或提交市场的插件目录。
- 新增 [WorkBuddy 插件发布指南](docs/WORKBUDDY.md)。

## 0.1.0 — 2026-10-25

- 基于官方结构化文档覆盖 41 个 Seerfar API，提供 45 个 MCP 工具和 3 个资源。
- 支持 stdio 与 Streamable HTTP，兼容 MCP 2025 版与 2026-07-28 版协议。
- 支持每次工具调用传入 API Key；HTTP 额外支持每次请求的 `X-Seerfar-Api-Key`。
- 保存原始文档快照、接口哈希、覆盖清单及参数 Schema，提供在线检查、同步和历史版本对照。
- 初始文档基线：`2026-10-25-a4154cba9736`；上游文档 v1.1，最新更新日期 2026-10-15。
