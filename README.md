# Seerfar API MCP

把 Seerfar Open API 接进 AI 客户端（Claude Desktop、Cursor、VS Code 及其他支持 MCP 的工具），用自然语言查询 Ozon、Wildberries 的店铺、竞品、类目、关键词、榜单与评论数据。

覆盖官方文档全部 **41 个接口**，注册 **45 个 MCP 工具** 和 **3 个资源**；同时支持 stdio 与 Streamable HTTP 两种连接方式。

- **API Key 两种给法**：WorkBuddy 插件里填一次，或每次调用随用随传；服务不落盘、不写日志、不做跨调用复用。
- **接口自带说明书**：AI 可以先查接口目录和完整中文文档，再按官方参数调用，无需人工对照网页。
- **文档可自我核对**：内置官方文档快照与哈希，可随时检查上游是否有新增或变更接口。

---

## 一、快速开始

### 1. 安装

需要 **Node.js 22 或更新版本**（`node -v` 确认）。

```sh
git clone <本仓库地址> seerfar-mcp
cd seerfar-mcp
npm ci
npm run build
```

`npm run build` 会生成 `dist/`，后续客户端直接运行里面的入口文件，不需要再启动终端。

### 2. 在客户端中注册服务

打开客户端的 MCP 配置文件，加入下面这段（**路径请改成本机真实的绝对路径**）：

```json
{
  "mcpServers": {
    "seerfar": {
      "command": "node",
      "args": ["/绝对路径/seerfar-mcp/dist/src/index.js"]
    }
  }
}
```

- 仓库里的 [`examples/mcp-config.json`](examples/mcp-config.json) 是同样内容的可复制版本。
- 配置写的是 `node` 命令且**不带任何参数**：服务默认以 stdio 模式运行，与客户端通信。
- 如果客户端提示找不到 `node`（常见于 nvm / fnm 安装），把 `command` 换成 `node` 的绝对路径，例如 `/Users/你的用户名/.nvm/versions/node/v22.11.0/bin/node`（`which node` 可查看）。
- 保存后重启客户端，工具列表里出现 `seerfar_list_apis` 等 `seerfar_*` 即表示接入成功。

### 3. WorkBuddy 插件（推荐）

如果使用 WorkBuddy，可以直接打包成插件安装：

```sh
npm run package:workbuddy
```

生成 `release/seerfar-marketplace/` 后，在 WorkBuddy「设置 → 插件 → 市场 → 添加市场」中选择该目录，安装 `seerfar-mcp`，再在插件配置里填写 Seerfar API Key。

插件会把 Key 以 `SEERFAR_API_KEY` 环境变量注入 MCP 服务，业务工具不再暴露 `apiKey` 参数。完整的上架流程见 [WorkBuddy 插件发布指南](docs/WORKBUDDY.md)。

### 4. 开始对话

服务启动后无需联网读取文档，随时可以这样问：

> 用 `seerfar_list_apis` 看看你能查哪些 Seerfar 数据。

> 用我这次提供的 Key 查一下积分：`sk-xxxx`。

> 用 Ozon 竞品接口查 SKU `175924376` 最近 30 天的数据。

AI 会自动挑选工具并组织参数；你也可以直接点名某个工具，见下方[工具一览](#三工具一览)。

---

## 二、API Key 怎么给

普通 MCP 客户端取 Key 的优先级：**工具参数 `apiKey` > HTTP 请求头 `X-Seerfar-Api-Key` > 启动环境变量 `SEERFAR_API_KEY`**。WorkBuddy 插件模式只使用插件设置注入的 Key，工具 Schema 不暴露 `apiKey`。

### 1. WorkBuddy 插件（推荐）

在 WorkBuddy 的插件配置面板填写「Seerfar API Key」。该值是敏感配置：

- WorkBuddy 存进系统凭据存储，不写进插件文件或 `settings.json`。
- 启动 MCP 服务时通过 `.mcp.json` 的 `${user_config.api_key}` 注入 `SEERFAR_API_KEY`。
- 服务端只在内存中使用，不落盘、不写日志；上游响应若回显 Key 会被脱敏为 `[REDACTED]`。
- 插件模式下工具 Schema 不暴露 `apiKey`，避免 Key 进入对话记录；普通 MCP 客户端仍可用 `apiKey` 参数临时指定 Key。

### 2. 普通 MCP 客户端

没有插件配置时，每个业务工具使用 `apiKey` 参数：

```json
{"apiKey": "你的 API Key"}
```

- 支持原始 Key 或 `Bearer 你的Key` 两种写法。
- 缺少或格式非法的 Key 不会发起任何上游请求，直接返回鉴权错误。
- Key 会作为工具参数经过客户端传输，因此**客户端的聊天记录、日志和工具调用记录**按该客户端自身的设置保存；请不要在共享会话或公开渠道里粘贴生产 Key。

### 3. HTTP 模式

HTTP 模式支持在**每个 MCP HTTP 请求**上带 `X-Seerfar-Api-Key` 请求头，也支持每次调用的 `apiKey` 参数；两者同时提供时以工具参数为准。请求头里的 Key 不做会话级保存。

> 启动时如果设置了 `SEERFAR_API_KEY`，HTTP 模式也会把它作为兜底 Key；面向多用户部署时请自行做好鉴权与隔离。

---

## 三、工具一览

### 查询类工具（无需 Key）

| 工具 | 用途 |
| --- | --- |
| `seerfar_list_apis` | 列出全部接口，可用 `keyword` 按 ID、名称或路径筛选 |
| `seerfar_get_api_doc` | 按 `id` 或工具名查看完整中文文档：参数、必填条件、响应字段、示例、费用、错误说明 |
| `seerfar_api_version` | 查看服务版本、当前文档快照、内容哈希与上游更新日期 |
| `seerfar_check_api_updates` | 在线只读比对官方文档与当前快照，报告新增、删除和字段变化 |

推荐工作流：**先 `seerfar_list_apis` 找接口 → 再 `seerfar_get_api_doc` 看参数 → 最后调用业务工具。**

### 业务工具

每个官方接口对应一个独立工具，命名为 `seerfar_` + 官方接口 ID（短横线换成下划线），例如 `seerfar_ozon_product_detail_search`。

| 数据类别 | 接口数 | 典型工具 |
| --- | ---: | --- |
| 积分 | 1 | `seerfar_quota` |
| 店铺、店铺品牌、店铺类目 | 6 | `seerfar_ozon_shop_search` |
| 竞品、相似商品、变体特征、Top 变体、变体分页 | 10 | `seerfar_ozon_product_detail_search` |
| 类目 | 2 | `seerfar_ozon_category_search` |
| 热销榜单、市场热词 | 4 | `seerfar_ozon_product_report_search` |
| 关键词挖掘、关键词反查 | 4 | `seerfar_ozon_keyword_mining` |
| 商品采集、采集箱分页 | 4 | `seerfar_ozon_product_collect` |
| 评论分析：任务、报表、词频、统计、原始评论 | 10 | `seerfar_ozon_review_analyse_task_add` |

Ozon 与 Wildberries 各有对应工具；完整清单（路径、积分费用、调用频率）见 [接口覆盖清单](docs/API_COVERAGE.md)。

### 资源

| URI | 内容 |
| --- | --- |
| `seerfar://api/version` | 版本与文档快照信息 |
| `seerfar://api/catalog` | 当前接口目录 |
| `seerfar://api/updates` | 上游更新记录 |

---

## 四、常见调用示例

### 查积分

工具：`seerfar_quota`

```json
{"apiKey": "你的 API Key"}
```

用在正式查询前确认余额与 Key 是否有效，这个接口不消耗积分。

### 查 Ozon 竞品

工具：`seerfar_ozon_product_detail_search`

```json
{
  "apiKey": "你的 API Key",
  "body": {"sku": "175924376", "dateRange": "past_30_days"}
}
```

### 查 Ozon 店铺

工具：`seerfar_ozon_shop_search`

```json
{
  "apiKey": "你的 API Key",
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

### 多步任务：采集商品后读采集箱

先 `seerfar_ozon_product_collect` 提交 SKU，再用 `seerfar_wb_collect_box_page` / `seerfar_ozon_collect_box_page` 分页查询结果。评论分析任务同理：创建任务后按任务 ID 轮询报表。**服务不会自动重试或自动翻页**，每一步都由你或 AI 按需触发。

### 参数怎么填

工具输入按接口需要包含 `body`、`path`、`query`、`headers` 四类字段，当前全部接口使用 GET 或 JSON POST：

- 参数按官方类型、必填条件、嵌套对象、数组和枚举校验，缺失必填项会被拒绝。
- 官方示例中可选的 `null` 过滤条件允许传入；部分数值字段官方示例用字符串，两种写法都兼容并原样转发。
- `body` 允许带参数表未列出的扩展字段；数量、日期等业务限制仍由上游校验。
- 不确定字段时直接问 AI 或调用 `seerfar_get_api_doc`，不要凭猜测拼参数。

---

## 五、HTTP 模式（自建或局域网接入）

适合需要长期运行、被多个客户端共用，或通过 URL 接入（`examples/mcp-http-config.json`）的场景：

```sh
npm start -- --transport http --port 3000
```

| 地址 | 用途 |
| --- | --- |
| `http://127.0.0.1:3000/mcp` | MCP 接入端点 |
| `http://127.0.0.1:3000/health` | 健康检查，返回状态与当前快照 ID |

客户端侧配置：

```json
{
  "mcpServers": {
    "seerfar": {"url": "http://127.0.0.1:3000/mcp"}
  }
}
```

HTTP 模式同样支持每次调用的 `apiKey` 参数，也可以在**每个 MCP HTTP 请求**上带 `X-Seerfar-Api-Key` 请求头。两者同时提供时以工具参数为准；都缺失时再回退到启动环境变量 `SEERFAR_API_KEY`，仍没有则不调用上游。请求头里的 Key 不做会话级保存。

服务使用无状态连接，默认只监听 `127.0.0.1` 并校验 Host 与 Origin，**面向本机或受信环境使用**。若需跨机器访问，请自行在反向代理层完成鉴权与 TLS。

### 启动参数

| 参数 | 环境变量 | 默认值 |
| --- | --- | --- |
| `--transport stdio\|http` | — | `stdio` |
| `--port 3000` | — | `3000` |
| `--base-url URL` | `SEERFAR_BASE_URL` | `https://api.seerfar.cn` |
| `--timeout-ms 30000` | `SEERFAR_TIMEOUT_MS` | `30000` |
| — | `SEERFAR_API_KEY` | 无；WorkBuddy 插件会自动注入 |

上游地址只能由启动配置指定，工具参数无法更换请求目标；服务不跟随上游重定向。

---

## 六、返回结果与错误

每次调用返回 `httpStatus` 和完整 `response`：

- HTTP 非 2xx，或业务 `code != 200`，标记为 MCP 错误（`isError`）。
- 触发限流时保留上游的 `retryAfter`，可按该值稍后重试。
- 超时、网络失败、非 JSON 响应同样以错误返回。
- 响应结构不做固定裁剪，上游新增字段会原样透出，便于后续按需取值。

**计费与副作用**：部分接口按次或按 SKU 扣积分，商品采集与创建分析任务还会写入账号数据。服务不会自动重试，也不会替你做付费验证调用；调用前请确认意图与费用（`seerfar_get_api_doc` 中标注了每个接口的积分与频率）。

---

## 七、常见问题

**客户端里看不到 `seerfar_*` 工具？**
检查 `args` 中的路径是否为绝对路径且存在 `dist/src/index.js`（先跑过 `npm run build`），然后重启客户端。

**提示 `spawn node ENOENT` 或找不到命令？**
`command` 改用 `node` 的绝对路径（`which node` 查看）。

**调用时报鉴权错误？**
WorkBuddy 插件用户先在插件配置里填写 Key；普通 MCP 客户端确认本次调用带了 `apiKey`，且 Key 没有多余空格。可先用 `seerfar_quota` 验证 Key 与余额。

**要联网才能用吗？**
不需要。接口文档以快照形式随项目保存，只有 `seerfar_check_api_updates` 和文档同步会访问官方页面。

**服务会不会改我的账号数据？**
只会执行你（或 AI 经你确认后）发起的调用；采集、创建分析任务等写操作由你决定是否触发。

**Windows 路径怎么写？**
JSON 中反斜杠需转义，例如 `"C:\\\\tools\\\\seerfar-mcp\\\\dist\\\\src\\\\index.js"`。

---

## 八、维护与开发

文档快照同步、版本差异对照、测试与协议兼容性验证等研发流程，见 [维护指南](docs/MAINTENANCE.md)；接口明细见 [接口覆盖清单](docs/API_COVERAGE.md)，版本变化见 [变更记录](CHANGELOG.md)。

```sh
npm run check   # 类型检查 + 全部测试
npm run dev     # 以 tsx 直接运行源码
npm run package:workbuddy   # 生成 WorkBuddy 自包含插件目录
```
