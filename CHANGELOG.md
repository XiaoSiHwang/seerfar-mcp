# 变更记录

## 0.2.0 — 2026-11-08

- 采用 MIT 许可证，补充 `LICENSE` 文件、`package.json` 与 `.codebuddy-plugin/plugin.json` 的 `license` 字段，并移除 `package.json` 的 `private`，具备 npm 发布条件。
- 新增 `npm run workbuddy:key`：把 Seerfar API Key 写入 `~/.workbuddy/credentials.json`（权限 0600），支持 `--show` 掩码核对与 `--clear` 清除；自动跟随已安装插件的 `seerfar-mcp@<市场名>`。
- 插件 Key 注入从 `${user_config.api_key}` 改为 `${PLUGIN_OPT:api_key}`，并把 `userConfig.api_key.required` 改为 `false`：WorkBuddy 5.9.3 没有渲染 `userConfig` 表单，必填项缺失会让 MCP 直接启动失败；现在未配置 Key 时插件照常启动，业务工具改为要求 `apiKey` 参数。
- 增加 WorkBuddy / CodeBuddy 插件清单 `.codebuddy-plugin/plugin.json` 与 `.mcp.json`。
- 支持在 WorkBuddy 插件中配置 Seerfar API Key，通过敏感项 `userConfig.api_key` 注入 `SEERFAR_API_KEY`；服务端按工具参数 > HTTP 请求头 > 插件环境变量的优先级取 Key（注入变量已从 `user_config` 改为 `PLUGIN_OPT`，见上）。
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
