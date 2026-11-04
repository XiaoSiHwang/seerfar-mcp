# Seerfar API MCP

基于官方 MCP TypeScript SDK 的 Seerfar Open API 服务，覆盖当前文档全部 **41 个 API**，支持 Ozon、Wildberries、动态 API Key 和 API 文档版本对照。提供 stdio 与 Streamable HTTP；兼容 MCP 2025 版与 2026-07-28 版协议。

## 快速开始

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run build
npm start
```

默认以 stdio 模式运行，等待 MCP 客户端发送协议消息；业务调用不需要在启动配置中设置 API Key。

对于采用 `mcpServers` JSON 配置的客户端，配置示例如下；请使用本机实际绝对路径。其他客户端按其自身配置格式填写相同命令及参数。

```json
{
  "mcpServers": {
    "seerfar": {
      "command": "node",
      "args": ["/Users/leslie/Documents/GZYQ-Project/seerfar-api-mcp/dist/src/index.js"]
    }
  }
}
```

不要把 `npm start` 的控制台输出直接当作协议输入；客户端直接执行上面的 `node` 命令。服务启动后不需要在线读取文档，使用随项目保存的快照。

## 动态传入 API Key

每个业务工具都有 `apiKey` 参数，服务仅将其加入本次上游请求的 `Authorization: Bearer ...` 请求头。支持直接传原始 Key 或 `Bearer ...`。Key 不写入服务配置、环境变量或服务日志，不在不同调用之间复用。

先调用 `seerfar_list_apis` 找到接口，再通过 `seerfar_get_api_doc` 查看参数和完整示例。

查询积分，工具 `seerfar_quota`：

```json
{"apiKey": "本次调用的API Key"}
```

查询 Ozon 竞品，工具 `seerfar_ozon_product_detail_search`：

```json
{
  "apiKey": "本次调用的API Key",
  "body": {"sku": "175924376", "dateRange": "past_30_days"}
}
```

查询 Ozon 店铺，工具 `seerfar_ozon_shop_search`：

```json
{
  "apiKey": "本次调用的API Key",
  "body": {
    "id": 118364,
    "page": {
      "pageNumber": 1,
      "pageSize": 20,
      "orders": [{"field": "revenue", "direction": "DESC"}]
    }
  }
}
```

服务不记录 Key，但通过工具参数提供的 Key 会经过调用方客户端；客户端的聊天记录和工具记录遵循客户端自身设置。

## HTTP 接入

```sh
npm start -- --transport http --port 3000
```

MCP 地址为 `http://127.0.0.1:3000/mcp`，健康检查为 `http://127.0.0.1:3000/health`。HTTP 模式仍支持每次调用的 `apiKey` 参数，也可以在**每个 MCP HTTP 请求**中传入 `X-Seerfar-Api-Key`。同时提供时，工具参数优先；二者均缺失时不调用上游。请求头的 Key 不保存在会话中。

服务使用无状态 HTTP 连接，默认仅监听 `127.0.0.1`，并校验 Host 和 Origin。当前交付范围是本地服务，未部署到公网。

## 接口覆盖

| 类别 | 接口数 |
| --- | ---: |
| API Key 积分 | 1 |
| 店铺、店铺品牌、店铺类目 | 6 |
| 竞品、相似商品、变体特征、Top 变体、变体分页 | 10 |
| 类目 | 2 |
| 热销榜单、市场热词 | 4 |
| 关键词挖掘、关键词反查 | 4 |
| 商品采集、采集箱分页 | 4 |
| 评论分析任务、报表、词频、统计、原始评论 | 10 |

每个 API 注册独立工具，名称为 `seerfar_` 加官方接口 ID（短横线改为下划线）。完整路径、费用和频率见 [接口覆盖清单](docs/API_COVERAGE.md)。工具输入按需要包含 `body`、`path`、`query`、`headers`；当前文档的全部接口使用 GET 或 JSON POST。

另外提供 4 个无需 API Key 的工具：

| 工具 | 功能 |
| --- | --- |
| `seerfar_list_apis` | 列出接口，支持 `keyword` 筛选 |
| `seerfar_get_api_doc` | 按 `id` 或工具名查看完整中文接口文档 |
| `seerfar_api_version` | 查看服务版本、文档快照、哈希、上游更新日期 |
| `seerfar_check_api_updates` | 在线只读比对官方文档与运行中基线 |

同时提供 `seerfar://api/version`、`seerfar://api/catalog`、`seerfar://api/updates` 三个 MCP 资源。

## 版本对照与迭代

以官方页面实际加载的三份 JSON 作为来源：

- [接口配置](http://doc.seerfar.cn/api-docs.config.json)：请求、响应、示例和说明。
- [更新记录](http://doc.seerfar.cn/api-updates.json)：上游按日期发布的变化。
- [费用与频率](http://doc.seerfar.cn/api-pricing.example.json)：各接口积分和调用频率。

初始基线抓取于 **2026-10-25**，页面标注版本 **v1.1**，最新更新日期 **2026-10-15**。页面版本号可能不随每次更新而变化，因此使用三份数据的 SHA-256 内容哈希识别实际更新，分别记录每个接口的请求、响应、说明及费用哈希。

检查官方更新：

```sh
npm run api:check
```

生成 `reports/api-diff.json` 与 `reports/api-diff.md`，报告新增、删除、修改的接口及字段路径；JSON 包含修改前后的值，同时检测基础地址、公共说明、上游更新记录和定价变化。退出码 `0` 表示无更新，`2` 表示有更新，`1` 表示获取或校验失败。检查不会修改当前基线。

采用新文档并更新基线：

```sh
npm run api:sync
npm run check
```

同步保存不可覆盖的历史快照、更新当前清单和工具 Schema，并将版本差异保存到 `docs/changes/`。接口工具由快照生成，通常无需手写新接口；未支持的参数类型会阻止同步。仍需检查差异并验证业务兼容性；如果上游改用文件上传等新请求编码，需要补充适配。完成后重启 MCP 服务。已运行的服务继续使用启动时加载的快照。

比较任意两个已保存版本：

```sh
npm run api:diff -- <旧快照ID> <新快照ID>
```

离线导入或检查：将官方三份 JSON 保存为同一目录下的 `config.json`、`updates.json`、`pricing.json`，再执行 `npm run api:sync -- --from-dir /绝对路径` 或 `npm run api:check -- --from-dir /绝对路径`。

`api/current.json` 保存当前版本及每个接口的哈希；`api/snapshots/` 保存完整历史原文；`api/catalog.json` 保存生成的工具 Schema。建议将这些文件与代码一并纳入版本管理。

## 请求行为与验证

默认 API 地址为 `https://api.seerfar.cn`，已验证该地址可访问。官方页面配置目前使用 HTTP，MCP 的业务请求优先使用同域 HTTPS。文档站点目前 HTTPS 证书不匹配，文档同步按官方链接使用 HTTP，不携带 API Key。

可通过 `--base-url` / `SEERFAR_BASE_URL` 指定 API 地址，通过 `--timeout-ms` / `SEERFAR_TIMEOUT_MS` 指定超时，默认 30 秒。API 地址只能由服务启动配置指定，工具参数不能更换请求目标；不跟随上游重定向。

参数按官方类型、必填条件、嵌套对象、数组及明确枚举校验。允许示例中的可选 `null` 过滤条件；部分数值字段的官方示例使用字符串，兼容这两种写法并原样转发。参数表未列出的示例字段保留，`body` 允许扩展字段；描述中的数量、日期等业务限制仍由上游校验。响应不强制套用固定结构，避免丢失上游新增字段。

工具结果包含 `httpStatus` 和完整 `response`，HTTP 非成功状态或业务 `code != 200` 标记为 MCP `isError`；限流时保留 `retryAfter`。超时、网络失败、非 JSON 响应也作为错误返回。上游响应若回显本次 Key 会脱敏。

部分查询会扣积分，商品采集和分析任务会写入账号数据。服务不自动重试、不自动翻页，也不为验证调用付费接口；分页、轮询和后续任务由调用方按用户意图发起。

```sh
npm run check
```

验证包含全部 41 个官方请求示例和转发路径、动态 Key 隔离、鉴权/业务/限流错误、超时、版本差异，以及官方 MCP 客户端通过两版协议连接 stdio 和 HTTP。真实账号权限、积分扣费和业务返回数据需要使用有效 API Key 后另行验收。
